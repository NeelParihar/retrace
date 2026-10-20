import type { StepRow } from "./types";

export function upsertStep(list: StepRow[], s: StepRow): StepRow[] {
  return [...list.filter((x) => x.id !== s.id), s].sort((a, b) => a.idx - b.idx);
}
