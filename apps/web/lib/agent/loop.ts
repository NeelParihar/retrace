import { randomUUID } from "node:crypto";
import type { Repo } from "../db/repo";
import { finalizeTrace, newTraceRow } from "../traces";
import type { LlmOutput, Msg, ToolCall, ToolInput, ToolOutput, TraceRow, TraceStatus } from "../types";
import type { Clock } from "./clock";
import { hashString } from "./hash";
import { Recorder } from "./recorder";
import { runTool, TOOL_DEFS } from "./tools";
import type { AgentEvent, ModelProvider } from "./types";

export const SYSTEM_PROMPT =
  "You are a concise research assistant. Use web_search to find facts, calculator for any arithmetic, " +
  "and notes to save your final answer before replying. Reply in one or two sentences.";

export const MAX_LLM_CALLS = 8;

export interface RunDeps {
  repo: Repo;
  provider: ModelProvider;
  clock: Clock;
  emit: (e: AgentEvent) => void;
  failFirst?: number;
  maxLlmCalls?: number;
}

export interface AgentState {
  messages: Msg[];
  pending: ToolCall[];
}

export async function createRunTrace(
  deps: RunDeps,
  p: {
    projectId: string;
    name: string;
    input: unknown;
    metadata?: Record<string, unknown>;
    parentTraceId?: string | null;
    forkedFromStepIndex?: number | null;
    createdAtMs?: number;
  },
): Promise<{ trace: TraceRow; recorder: Recorder }> {
  const prices = await deps.repo.getPricing();
  const trace = newTraceRow({
    id: randomUUID(),
    project_id: p.projectId,
    name: p.name,
    input: p.input,
    provider: deps.provider.kind,
    metadata: { model: deps.provider.model, ...p.metadata },
    parent_trace_id: p.parentTraceId ?? null,
    forked_from_step_index: p.forkedFromStepIndex ?? null,
    created_at: new Date(p.createdAtMs ?? deps.clock.now()).toISOString(),
  });
  await deps.repo.insertTrace(trace);
  deps.emit({ type: "trace", data: trace });
  return { trace, recorder: new Recorder(deps.repo, prices, deps.clock, deps.emit, trace.id) };
}

export async function startRun(deps: RunDeps, p: { projectId: string; task: string; name?: string }): Promise<TraceRow> {
  const { recorder } = await createRunTrace(deps, {
    projectId: p.projectId,
    name: p.name ?? "research-assistant",
    input: { task: p.task },
  });
  return drive(deps, recorder, { messages: [{ role: "user", content: p.task }], pending: [] });
}

/** Runs the loop to completion and finalizes the trace. Never throws for agent failures. */
export async function drive(deps: RunDeps, rec: Recorder, state: AgentState): Promise<TraceRow> {
  const emit = (e: AgentEvent) => {
    try {
      deps.emit(e);
    } catch {
      /* a broken event sink must not stop the trace from being finalized */
    }
  };
  let result: { status: TraceStatus; output: unknown };
  try {
    result = await continueRun(deps, rec, state);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    emit({ type: "error", data: { message } });
    result = { status: "error", output: { error: message } };
  }
  const done = await finalizeTrace(deps.repo, rec.traceId, result.status, result.output, deps.clock.now());
  emit({ type: "done", data: done });
  return done;
}

async function continueRun(deps: RunDeps, rec: Recorder, state: AgentState): Promise<{ status: TraceStatus; output: unknown }> {
  const max = deps.maxLlmCalls ?? MAX_LLM_CALLS;
  for (;;) {
    const next = state.pending.shift();
    if (next) {
      await executeTool(deps, rec, state, next);
      continue;
    }
    if (rec.llmCount >= max) return { status: "error", output: { error: `max model calls (${max}) reached` } };

    const step = await rec.record(
      { type: "llm", name: "model", model: deps.provider.model, input: { messages: structuredClone(state.messages) } },
      async () => {
        const c = await deps.provider.complete({ system: SYSTEM_PROMPT, messages: state.messages, tools: TOOL_DEFS });
        if (c.simulatedLatencyMs) await deps.clock.sleep(c.simulatedLatencyMs);
        const output: LlmOutput = { text: c.text, toolCalls: c.toolCalls };
        return { output, usage: c.usage };
      },
    );
    if (step.error) return { status: "error", output: { error: step.error } };

    const out = step.output as LlmOutput;
    state.messages.push({ role: "assistant", text: out.text, toolCalls: out.toolCalls });
    if (out.toolCalls.length === 0) return { status: "success", output: { answer: out.text } };
    state.pending = [...out.toolCalls];
  }
}

export async function executeTool(deps: RunDeps, rec: Recorder, state: AgentState, call: ToolCall): Promise<void> {
  const input: ToolInput = { toolCallId: call.id, args: call.input };
  const step = await rec.record({ type: "tool", name: call.name, input }, async () => {
    const r = await runTool(call.name, call.input, { history: state.messages, failFirst: deps.failFirst ?? 0 });
    await deps.clock.sleep(60 + (hashString(r.content) % 340));
    return { output: r, error: r.isError ? r.content : null };
  });
  const out = (step.output as ToolOutput | null) ?? { content: step.error ?? "tool failed", isError: true };
  state.messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: out.content, isError: out.isError });
}
