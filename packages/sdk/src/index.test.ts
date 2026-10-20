import { describe, expect, it, vi } from "vitest";
import { Retrace } from "./index";

type Call = { url: string; init: RequestInit };

function mockFetch(statuses: (number | Error)[]) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const s = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    if (s instanceof Error) throw s;
    return new Response(JSON.stringify({ results: [] }), { status: s });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const batchOf = (c: Call) => (JSON.parse(String(c.init.body)) as { batch: { type: string }[] }).batch;

describe("Retrace SDK", () => {
  it("batches a trace into ordered events on end()", async () => {
    const { fn, calls } = mockFetch([200]);
    const rt = new Retrace({ apiKey: "k", baseUrl: "https://example.test/", fetch: fn, flushIntervalMs: 60_000 });
    const trace = rt.trace({ name: "bot", input: { q: 1 } });
    const span = trace.span({ name: "retrieve" });
    trace.tool({ name: "kb.search", input: { q: 1 }, parentId: span.id }).end({ output: { hits: 2 } });
    span.end();
    trace.generation({ name: "answer", model: "claude-haiku-4-5" }).end({ output: "hi", usage: { promptTokens: 10, completionTokens: 2 } });
    await trace.end({ output: "hi" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://example.test/api/ingest");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer k");
    expect(batchOf(calls[0]).map((e) => e.type)).toEqual([
      "trace.create", "step.create", "step.create", "step.end", "step.end", "step.create", "step.end", "trace.end",
    ]);
  });

  it("retries on 5xx and network errors", async () => {
    const { fn, calls } = mockFetch([500, new Error("ECONNRESET"), 207]);
    const rt = new Retrace({ apiKey: "k", baseUrl: "https://x", fetch: fn, retryDelayMs: 1 });
    await rt.trace({ name: "t" }).end();
    expect(calls).toHaveLength(3);
  });

  it("never throws into user code and drops batches on 4xx", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fn, calls } = mockFetch([401]);
    const rt = new Retrace({ apiKey: "bad", baseUrl: "https://x", fetch: fn, retryDelayMs: 1 });
    await expect(rt.trace({ name: "t" }).end()).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[retrace]"));
    warn.mockRestore();
  });

  it("auto-flushes when the queue reaches flushAt", async () => {
    const { fn, calls } = mockFetch([200]);
    const rt = new Retrace({ apiKey: "k", baseUrl: "https://x", fetch: fn, flushAt: 2, flushIntervalMs: 60_000 });
    const t = rt.trace({ name: "t" });
    t.span({ name: "s" });
    await rt.flush();
    expect(batchOf(calls[0])).toHaveLength(2);
  });
});
