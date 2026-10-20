import type { TraceRow } from "./types";

export interface Stats {
  traces: number;
  tokens: number;
  cost: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  costByDay: { day: string; cost: number }[];
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function computeStats(traces: TraceRow[], now: number, days = 14): Stats {
  const latencies = traces.flatMap((t) => (t.latency_ms == null ? [] : [t.latency_ms])).sort((a, b) => a - b);
  const byDay = new Map<string, number>();
  for (const t of traces) {
    const day = t.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + t.total_cost);
  }
  const costByDay = Array.from({ length: days }, (_, i) => {
    const day = new Date(now - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day, cost: round6(byDay.get(day) ?? 0) };
  });
  return {
    traces: traces.length,
    tokens: traces.reduce((n, t) => n + t.total_tokens, 0),
    cost: round6(traces.reduce((n, t) => n + t.total_cost, 0)),
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
    costByDay,
  };
}
