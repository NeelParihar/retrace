import { describe, expect, it } from "vitest";
import { layoutWaterfall } from "./waterfall";

const T0 = Date.parse("2026-10-01T10:00:00Z");
const s = (id: string, start: number, end: number | null) => ({
  id,
  started_at: new Date(T0 + start).toISOString(),
  ended_at: end == null ? null : new Date(T0 + end).toISOString(),
});

describe("layoutWaterfall", () => {
  it("positions bars proportionally with labelled ticks", () => {
    const w = layoutWaterfall([s("a", 0, 1000), s("b", 1000, 3000), s("c", 3000, 4000)]);
    expect(w.totalMs).toBe(4000);
    expect(w.bars.map((b) => [b.leftPct, b.widthPct])).toEqual([[0, 25], [25, 50], [75, 25]]);
    expect(w.ticks.map((t) => t.label)).toEqual(["0ms", "1.00s", "2.00s", "3.00s", "4.00s"]);
  });
  it("keeps instant and unfinished steps visible", () => {
    const w = layoutWaterfall([s("a", 0, 0), s("b", 0, 2000), s("c", 2000, null)]);
    expect(w.bars[0].widthPct).toBe(0.6);
    expect(w.bars[2]).toMatchObject({ leftPct: 99.4, widthPct: 0.6, durationMs: 0 });
  });
  it("handles no steps", () => {
    expect(layoutWaterfall([])).toEqual({ totalMs: 0, bars: [], ticks: [] });
  });
});
