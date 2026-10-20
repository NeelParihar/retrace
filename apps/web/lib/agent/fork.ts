import type { Repo } from "../db/repo";
import type { ToolInput, ToolOutput, TraceRow } from "../types";
import { displayStatus } from "../status";
import { finalizeTrace } from "../traces";
import { ForkError, planFork, type ForkPlan } from "./fork-plan";
import { createRunTrace, drive, type RunDeps } from "./loop";

export async function prepareFork(
  repo: Repo,
  projectId: string,
  sourceId: string,
  stepIndex: number,
  editedInput: string | null,
): Promise<{ source: TraceRow; plan: ForkPlan }> {
  const source = await repo.getTrace(sourceId);
  if (!source || source.project_id !== projectId) throw new ForkError("trace not found", 404);
  if (source.provider === "sdk") throw new ForkError("Fork requires a replayable agent", 422);
  if (displayStatus(source, Date.now()) === "running") throw new ForkError("trace is still running", 409);
  const plan = planFork(await repo.getSteps(sourceId), stepIndex, editedInput);
  return { source, plan };
}

export async function executeFork(
  deps: RunDeps,
  projectId: string,
  { source, plan }: { source: TraceRow; plan: ForkPlan },
): Promise<TraceRow> {
  // Lay the copied prefix out so it ends "now", preserving its original spacing.
  const now = deps.clock.now();
  const firstStart = plan.copy.length ? Date.parse(plan.copy[0].started_at) : now;
  const lastEnd = plan.copy.reduce((m, s) => Math.max(m, Date.parse(s.ended_at ?? s.started_at)), firstStart);
  const forkStart = now - (lastEnd - firstStart);
  const offset = forkStart - firstStart;

  const editsTask = plan.target.idx === 0 && plan.target.type === "llm" && plan.edited;
  const { recorder } = await createRunTrace(deps, {
    projectId,
    name: source.name,
    input: editsTask ? { task: plan.state.messages[0].role === "user" ? plan.state.messages[0].content : "" } : source.input,
    metadata: { forked_from: source.id, edited: plan.edited },
    parentTraceId: source.id,
    forkedFromStepIndex: plan.target.idx,
    createdAtMs: forkStart,
  });
  let state;
  try {
    for (const s of plan.copy) await recorder.copy(s, offset);
    state = structuredClone(plan.state);
    if (plan.editedToolOutput !== null) {
      const callId = (plan.target.input as ToolInput).toolCallId;
      const call = state.pending.find((c) => c.id === callId)!;
      state.pending = state.pending.filter((c) => c.id !== callId);
      const out: ToolOutput = { content: plan.editedToolOutput, isError: false };
      const input: ToolInput = { toolCallId: call.id, args: call.input };
      await recorder.record({ type: "tool", name: call.name, input, metadata: { edited: true } }, async () => ({ output: out }));
      state.messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: out.content, isError: false });
    }
  } catch (e) {
    // Never leave a half-copied fork "running".
    const done = await finalizeTrace(deps.repo, recorder.traceId, "error", { error: e instanceof Error ? e.message : String(e) }, deps.clock.now());
    deps.emit({ type: "done", data: done });
    return done;
  }
  return drive(deps, recorder, state);
}
