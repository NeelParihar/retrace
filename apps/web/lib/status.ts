import type { TraceRow, TraceStatus } from "./types";

export const STALL_MS = 120_000;
export type DisplayStatus = TraceStatus | "stalled";

/** A run whose stream died (e.g. a function timeout) stays "running" in the DB; show it as stalled. */
export function displayStatus(t: Pick<TraceRow, "status" | "created_at">, now: number): DisplayStatus {
  return t.status === "running" && now - Date.parse(t.created_at) > STALL_MS ? "stalled" : t.status;
}
