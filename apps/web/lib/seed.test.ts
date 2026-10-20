import { beforeAll, describe, expect, it } from "vitest";
import { createMemoryRepo } from "./db";
import type { MemoryRepo } from "./db/memory";
import { DEMO_PROJECT_ID } from "./demo";
import { PRESET_TASKS, seedDemo } from "./seed";
import type { TraceRow } from "./types";

const NOW = Date.parse("2026-10-20T12:00:00Z");

describe("seedDemo", () => {
  let repo: MemoryRepo;
  let traceIds: string[];
  let traces: TraceRow[];
  beforeAll(async () => {
    repo = createMemoryRepo();
    ({ traceIds } = await seedDemo(repo, { now: NOW }));
    traces = await Promise.all(traceIds.map(async (id) => (await repo.getTrace(id))!));
  });

  it("creates 25 traces within the last 14 days", () => {
    expect(traces).toHaveLength(25);
    for (const t of traces) {
      expect(Date.parse(t.created_at)).toBeGreaterThan(NOW - 14 * 86_400_000);
      expect(Date.parse(t.created_at)).toBeLessThan(NOW);
      expect(t.status).not.toBe("running");
    }
  });

  it("includes errors, tool failures, forks and one SDK trace", async () => {
    expect(traces.filter((t) => t.status === "error").length).toBeGreaterThanOrEqual(1);
    expect(traces.filter((t) => t.parent_trace_id)).toHaveLength(5);
    expect(new Set(traces.filter((t) => t.parent_trace_id).map((t) => t.parent_trace_id)).size).toBe(3);
    expect(traces.filter((t) => t.provider === "sdk")).toHaveLength(1);
    const stepLists = await Promise.all(traceIds.map((id) => repo.getSteps(id)));
    expect(stepLists.some((steps) => steps.some((s) => s.error))).toBe(true);
  });

  it("uses each preset task as an original run", () => {
    for (const task of PRESET_TASKS) {
      expect(traces.some((t) => !t.parent_trace_id && (t.input as { task?: string })?.task === task)).toBe(true);
    }
  });

  it("is visible through the list API", async () => {
    const page = await repo.listTraces({ projectId: DEMO_PROJECT_ID, limit: 50 });
    expect(page.items).toHaveLength(25);
  });
});
