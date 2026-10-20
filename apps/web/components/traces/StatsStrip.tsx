import { formatCost, formatDuration, formatTokens } from "@/lib/format";
import type { Stats } from "@/lib/stats";
import { Sparkline } from "./Sparkline";

export function StatsStrip({ stats }: { stats: Stats }) {
  const cells: [string, string][] = [
    ["traces · 14d", String(stats.traces)],
    ["tokens", formatTokens(stats.tokens)],
    ["cost", formatCost(stats.cost)],
    [
      "latency p50 / p95",
      stats.p50LatencyMs == null ? "—" : `${formatDuration(stats.p50LatencyMs)} / ${formatDuration(stats.p95LatencyMs ?? 0)}`,
    ],
  ];
  const peak = Math.max(0, ...stats.costByDay.map((d) => d.cost));
  return (
    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-hairline bg-hairline lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(220px,1.3fr)]">
      {cells.map(([label, value]) => (
        <div key={label} className="bg-surface px-4 py-3">
          <div className="label">{label}</div>
          <div className="num mt-1 text-[18px]">{value}</div>
        </div>
      ))}
      <div className="col-span-2 bg-surface px-4 py-3 lg:col-span-1">
        <div className="label flex justify-between">
          <span>cost / day</span>
          <span className="num normal-case tracking-normal">peak {formatCost(peak)}</span>
        </div>
        <div className="mt-1.5">
          <Sparkline values={stats.costByDay.map((d) => d.cost)} />
        </div>
      </div>
    </section>
  );
}
