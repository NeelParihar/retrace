import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepo, setRepoForTests } from "@/lib/db";
import { DEMO_API_KEY } from "@/lib/demo";
import { POST } from "./route";

const req = (body: unknown, key: string | null = DEMO_API_KEY) =>
  new Request("http://localhost/api/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => setRepoForTests(createMemoryRepo()));
afterEach(() => setRepoForTests(null));

describe("POST /api/ingest", () => {
  it("401s without a valid key", async () => {
    expect((await POST(req({ batch: [] }, null))).status).toBe(401);
    expect((await POST(req({ batch: [] }, "wrong"))).status).toBe(401);
  });
  it("400s on malformed bodies", async () => {
    expect((await POST(req("{not json"))).status).toBe(400);
    expect((await POST(req({ batch: [] }))).status).toBe(400);
  });
  it("200s when every event succeeds and 207s otherwise", async () => {
    const id = randomUUID();
    const ok = await POST(req({ batch: [{ type: "trace.create", id, timestamp: new Date().toISOString(), name: "t" }] }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ results: [{ id, ok: true }] });
    const mixed = await POST(req({ batch: [{ type: "trace.end", id: randomUUID(), timestamp: new Date().toISOString() }] }));
    expect(mixed.status).toBe(207);
  });
  it("413s oversized bodies", async () => {
    const big = { batch: [{ type: "trace.create", id: randomUUID(), timestamp: new Date().toISOString(), name: "t", input: "x".repeat(600_000) }] };
    expect((await POST(req(big))).status).toBe(413);
  });
  it("429s after the hourly request budget", async () => {
    const { checkRateLimit, clientIpHash, INGEST_REQUESTS_PER_HOUR } = await import("@/lib/limits");
    const { getRepo } = await import("@/lib/db");
    const r = req({ batch: [{ type: "trace.create", id: randomUUID(), timestamp: new Date().toISOString(), name: "t" }] });
    const repo = await getRepo();
    for (let i = 0; i < INGEST_REQUESTS_PER_HOUR; i++) await checkRateLimit(repo, "ingest", clientIpHash(r), INGEST_REQUESTS_PER_HOUR, Date.now());
    expect((await POST(r)).status).toBe(429);
  });
});
