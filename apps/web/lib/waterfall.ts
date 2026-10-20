import { formatDuration } from "./format";
import type { StepRow } from "./types";

const MIN_W = 0.6;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function layoutWaterfall(steps: Pick<StepRow, "id" | "started_at" | "ended_at">[]) {
  if (steps.length === 0) return { totalMs: 0, bars: [], ticks: [] };
  const starts = steps.map((s) => Date.parse(s.started_at));
  const ends = steps.map((s, i) => (s.ended_at ? Date.parse(s.ended_at) : starts[i]));
  const t0 = Math.min(...starts);
  const t1 = Math.max(...ends);
  const total = Math.max(1, t1 - t0);
  const bars = steps.map((s, i) => {
    const left = Math.min(((starts[i] - t0) / total) * 100, 100 - MIN_W);
    const width = Math.max(MIN_W, Math.min(((ends[i] - starts[i]) / total) * 100, 100 - left));
    return { id: s.id, leftPct: r2(left), widthPct: r2(width), durationMs: ends[i] - starts[i] };
  });
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ pct: f * 100, label: formatDuration(f * (t1 - t0)) }));
  return { totalMs: t1 - t0, bars, ticks };
}
