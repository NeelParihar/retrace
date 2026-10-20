import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryRepo, setRepoForTests } from "@/lib/db";
import { seedDemo } from "@/lib/seed";
import type { TraceRow } from "@/lib/types";
import { GET as getDetail } from "./[id]/route";
import { GET as list } from "./route";
import { GET as stats } from "../stats/route";

let ids: string[];
beforeAll(async () => {
  const repo = createMemoryRepo();
  ids = (await seedDemo(repo, { now: Date.now() })).traceIds;
  setRepoForTests(repo);
});

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe("read APIs", () => {
  it("lists traces with filters", async () => {
    const res = await list(new Request("http://x/api/traces?status=error&limit=5"));
    const body = (await res.json()) as { items: TraceRow[]; nextCursor: string | null };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((t) => t.status === "error")).toBe(true);
  });
  it("returns trace detail with steps and lineage", async () => {
    const forkId = ids[19]; // first fork
    const res = await getDetail(new Request("http://x"), params(forkId));
    const body = await res.json();
    expect(body.trace.id).toBe(forkId);
    expect(body.parent.id).toBe(ids[0]);
    expect(body.steps.length).toBeGreaterThan(0);
  });
  it("404s for malformed and unknown ids", async () => {
    expect((await getDetail(new Request("http://x"), params("nope"))).status).toBe(404);
    expect((await getDetail(new Request("http://x"), params("00000000-0000-4000-8000-00000000dead"))).status).toBe(404);
  });
  it("serves stats", async () => {
    const body = await (await stats()).json();
    expect(body.traces).toBe(25);
    expect(body.costByDay).toHaveLength(14);
  });
});
