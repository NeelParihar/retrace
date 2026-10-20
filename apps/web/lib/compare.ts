import type { StepRow, TraceRow } from "./types";

export interface CompareRow {
  idx: number;
  left: StepRow | null;
  right: StepRow | null;
  diverged: boolean;
}

export function divergenceIndex(a: TraceRow, b: TraceRow, aSteps: StepRow[], bSteps: StepRow[]): number {
  if (b.parent_trace_id === a.id && b.forked_from_step_index != null) return b.forked_from_step_index;
  if (a.parent_trace_id === b.id && a.forked_from_step_index != null) return a.forked_from_step_index;
  const n = Math.max(aSteps.length, bSteps.length);
  for (let i = 0; i < n; i++) {
    const x = aSteps[i];
    const y = bSteps[i];
    if (!x || !y || x.type !== y.type || x.name !== y.name || JSON.stringify(x.output) !== JSON.stringify(y.output)) return i;
  }
  return n;
}

export function alignSteps(a: StepRow[], b: StepRow[], at: number): CompareRow[] {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, idx) => ({
    idx,
    left: a[idx] ?? null,
    right: b[idx] ?? null,
    diverged: idx >= at,
  }));
}
