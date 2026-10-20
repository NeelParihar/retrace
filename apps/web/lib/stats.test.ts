import { describe, expect, it } from "vitest";
import { computeStats } from "./stats";
import { displayStatus } from "./status";
import { newTraceRow } from "./traces";
import type { TraceRow } from "./types";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const t = (daysAgo: number, latency: number | null, cost: number, tokens = 100): TraceRow => ({
  ...newTraceRow({ id: `${daysAgo}-${latency}`, project_id: "p", name: "n", input: null, provider: "simulated", created_at: new Date(NOW - daysAgo * 86_400_000).toISOString() }),
  status: latency == null ? "running" : "success",
  latency_ms: latency,
  total_cost: cost,
  total_tokens: tokens,
});

describe("computeStats", () => {
  it("totals, percentiles and a zero-filled daily series", () => {
    const s = computeStats([t(0, 1000, 0.01), t(0, 3000, 0.02), t(2, 2000, 0.005), t(1, null, 0)], NOW, 14);
    expect(s).toMatchObject({ traces: 4, tokens: 400, cost: 0.035, p50LatencyMs: 2000, p95LatencyMs: 3000 });
    expect(s.costByDay).toHaveLength(14);
    expect(s.costByDay.at(-1)).toEqual({ day: "2026-10-20", cost: 0.03 });
    expect(s.costByDay.at(-3)).toEqual({ day: "2026-10-18", cost: 0.005 });
    expect(s.costByDay[0]).toEqual({ day: "2026-10-07", cost: 0 });
  });
  it("handles no data", () => {
    expect(computeStats([], NOW)).toMatchObject({ traces: 0, p50LatencyMs: null, p95LatencyMs: null });
  });
});

describe("displayStatus", () => {
  it("marks long-running traces as stalled", () => {
    expect(displayStatus({ status: "running", created_at: new Date(NOW - 30_000).toISOString() }, NOW)).toBe("running");
    expect(displayStatus({ status: "running", created_at: new Date(NOW - 600_000).toISOString() }, NOW)).toBe("stalled");
    expect(displayStatus({ status: "error", created_at: new Date(NOW - 600_000).toISOString() }, NOW)).toBe("error");
  });
});
