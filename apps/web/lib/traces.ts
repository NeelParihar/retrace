import type { Repo } from "./db/repo";
import type { Provider, StepRow, TraceRow, TraceStatus } from "./types";

export function newTraceRow(p: {
  id: string;
  project_id: string;
  name: string;
  input: unknown;
  provider: Provider;
  created_at: string;
  metadata?: Record<string, unknown>;
  parent_trace_id?: string | null;
  forked_from_step_index?: number | null;
}): TraceRow {
  return {
    id: p.id,
    project_id: p.project_id,
    name: p.name,
    status: "running",
    input: p.input ?? null,
    output: null,
    metadata: p.metadata ?? {},
    step_count: 0,
    total_tokens: 0,
    total_cost: 0,
    latency_ms: null,
    parent_trace_id: p.parent_trace_id ?? null,
    forked_from_step_index: p.forked_from_step_index ?? null,
    provider: p.provider,
    created_at: p.created_at,
    ended_at: null,
  };
}

export function summarizeSteps(steps: StepRow[]) {
  let total_tokens = 0;
  let total_cost = 0;
  for (const s of steps) {
    total_tokens += s.prompt_tokens + s.completion_tokens;
    total_cost += s.cost;
  }
  return { step_count: steps.length, total_tokens, total_cost: Math.round(total_cost * 1e6) / 1e6 };
}

export async function finalizeTrace(
  repo: Repo,
  traceId: string,
  status: TraceStatus,
  output: unknown,
  endedAtMs: number,
): Promise<TraceRow> {
  const trace = await repo.getTrace(traceId);
  if (!trace) throw new Error(`trace ${traceId} not found`);
  const steps = await repo.getSteps(traceId);
  const patch: Partial<TraceRow> = {
    ...summarizeSteps(steps),
    status,
    output: output ?? null,
    ended_at: new Date(endedAtMs).toISOString(),
    latency_ms: Math.max(0, Math.round(endedAtMs - Date.parse(trace.created_at))),
  };
  await repo.updateTrace(traceId, patch);
  return { ...trace, ...patch };
}
