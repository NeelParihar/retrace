import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryRepo, setRepoForTests } from "@/lib/db";
import { parseSseChunk } from "@/lib/sse-client";
import { seedDemo } from "@/lib/seed";
import { checkRateLimit, clientIpHash, RUNS_PER_HOUR } from "@/lib/limits";
import { getRepo } from "@/lib/db";
import { POST as fork } from "../traces/[id]/fork/route";
import { POST as run } from "./route";

let ids: string[];
beforeAll(async () => {
  const repo = createMemoryRepo();
  ids = (await seedDemo(repo, { now: Date.now() })).traceIds;
  setRepoForTests(repo);
});

const json = (body: unknown) => new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function readAll(res: Response) {
  const text = await res.text();
  return parseSseChunk(text + "\n\n").events;
}

describe("POST /api/runs", () => {
  it("rejects empty tasks", async () => {
    expect((await run(json({ task: "  " }))).status).toBe(400);
  });
  it("streams a full simulated run", async () => {
    const res = await run(json({ task: "How tall is Mount Everest?" }));
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const events = await readAll(res);
    expect(events[0].type).toBe("trace");
    expect(events.at(-1)).toMatchObject({ type: "done", data: { status: "success" } });
  });
  it("tells the user when live mode is unavailable", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const events = await readAll(await run(json({ task: "How tall is Mount Everest?", mode: "live" })));
    expect(events[0]).toMatchObject({ type: "notice" });
  });
});

describe("POST /api/traces/:id/fork", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  it("returns JSON errors before streaming", async () => {
    expect((await fork(json({ stepIndex: 0 }), params("nope"))).status).toBe(404);
    expect((await fork(json({ stepIndex: 99 }), params(ids[0]))).status).toBe(400);
    expect((await fork(json({ stepIndex: 0 }), params(ids[24]))).status).toBe(422); // SDK trace
    expect((await fork(json({ stepIndex: "x" }), params(ids[0]))).status).toBe(400);
  });
  it("streams a fork", async () => {
    const events = await readAll(await fork(json({ stepIndex: 0, editedInput: "How tall is Mount Everest?" }), params(ids[0])));
    expect(events.at(-1)).toMatchObject({ type: "done", data: { parent_trace_id: ids[0], forked_from_step_index: 0 } });
  });
});

describe("public write limits", () => {
  const from = (ip: string, body: unknown) =>
    new Request("http://x", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

  it("429s runs and forks once an IP has used its hourly budget", async () => {
    const req = from("9.9.9.9", { task: "How tall is Mount Everest?" });
    const repo = await getRepo();
    for (let i = 0; i < RUNS_PER_HOUR; i++) await checkRateLimit(repo, "run", clientIpHash(req), RUNS_PER_HOUR, Date.now());
    const res = await run(req);
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/try again/i);
    const f = await fork(from("9.9.9.9", { stepIndex: 0 }), { params: Promise.resolve({ id: ids[0] }) });
    expect(f.status).toBe(429);
  });

  it("strips NUL characters from tasks", async () => {
    const events = await readAll(await run(from("8.8.8.8", { task: "How tall\u0000 is Mount Everest?" })));
    expect(events[0]).toMatchObject({ type: "trace", data: { input: { task: "How tall is Mount Everest?" } } });
  });
});

