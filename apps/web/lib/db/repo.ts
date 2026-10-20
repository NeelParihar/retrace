import type { ModelPrice, StepRow, TraceRow, TraceStatus } from "../types";

export interface ListQuery {
  projectId: string;
  q?: string;
  status?: TraceStatus;
  cursor?: string | null;
  limit: number;
}

export interface Repo {
  getPricing(): Promise<ModelPrice[]>;
  findProjectByKeyHash(hash: string): Promise<{ id: string; name: string } | null>;
  /** Returns false when a trace with this id already exists. */
  insertTrace(t: TraceRow): Promise<boolean>;
  updateTrace(id: string, patch: Partial<TraceRow>): Promise<void>;
  getTrace(id: string): Promise<TraceRow | null>;
  /** Newest first. `cursor` is the created_at of the last item of the previous page. */
  listTraces(q: ListQuery): Promise<{ items: TraceRow[]; nextCursor: string | null }>;
  listTracesSince(projectId: string, sinceIso: string): Promise<TraceRow[]>;
  getForks(traceId: string): Promise<TraceRow[]>;
  /** Returns false when a step with this id already exists. */
  insertStep(s: StepRow): Promise<boolean>;
  updateStep(id: string, patch: Partial<StepRow>): Promise<void>;
  getStep(id: string): Promise<StepRow | null>;
  /** Ordered by idx ascending. */
  getSteps(traceId: string): Promise<StepRow[]>;
  /** Increments the counter for (ipHash, window) and returns true while it is <= max. */
  hitRateLimit(ipHash: string, windowStartIso: string, max: number): Promise<boolean>;
  getLiveUsage(day: string): Promise<{ live_cost: number; live_runs: number }>;
  addLiveUsage(day: string, cost: number): Promise<void>;
}
