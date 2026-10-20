import { displayStatus } from "../status";
import type { LlmInput, LlmOutput, Msg, StepRow, ToolCall, ToolInput, ToolOutput, TraceRow } from "../types";

export class ForkError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface ForkPlan {
  copy: StepRow[];
  target: StepRow;
  state: { messages: Msg[]; pending: ToolCall[] };
  editedToolOutput: string | null;
  edited: boolean;
}

export function planFork(steps: StepRow[], stepIndex: number, editedInput: string | null): ForkPlan {
  const sorted = [...steps].sort((a, b) => a.idx - b.idx);
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= sorted.length) {
    throw new ForkError(`stepIndex ${stepIndex} is out of range (0–${sorted.length - 1})`, 400);
  }
  const target = sorted[stepIndex];
  if (target.type === "span") throw new ForkError("Span steps can't be forked", 400);

  let messages: Msg[] = [];
  let pending: ToolCall[] = [];
  const copy = sorted.slice(0, stepIndex);
  for (const s of copy) {
    if (s.type === "llm") {
      const out = s.output as LlmOutput | null;
      if (!out) throw new ForkError(`Can't fork past a failed model step (#${s.idx})`, 400);
      messages = [...structuredClone((s.input as LlmInput).messages), { role: "assistant", text: out.text, toolCalls: out.toolCalls }];
      pending = [...out.toolCalls];
    } else if (s.type === "tool") {
      const inp = s.input as ToolInput;
      const out = s.output as ToolOutput | null;
      messages.push({ role: "tool", toolCallId: inp.toolCallId, name: s.name, content: out?.content ?? s.error ?? "", isError: out?.isError ?? true });
      pending = pending.filter((c) => c.id !== inp.toolCallId);
    }
  }

  if (target.type === "llm") {
    messages = structuredClone((target.input as LlmInput).messages);
    if (editedInput != null) {
      const last = messages[messages.length - 1];
      if (!last || last.role === "assistant") throw new ForkError("The last message before this step isn't editable", 400);
      last.content = editedInput;
    }
    return { copy, target, state: { messages, pending: [] }, editedToolOutput: null, edited: editedInput != null };
  }
  if (editedInput != null && !pending.some((c) => c.id === (target.input as ToolInput).toolCallId)) {
    throw new ForkError("The tool call for this step wasn't found in the copied history", 400);
  }
  return { copy, target, state: { messages, pending }, editedToolOutput: editedInput, edited: editedInput != null };
}

/** The text a user edits when forking from this step. */
export function editableTextFor(step: StepRow): string | null {
  if (step.type === "llm") {
    const last = (step.input as LlmInput | null)?.messages?.at(-1);
    return last && last.role !== "assistant" ? last.content : null;
  }
  if (step.type === "tool") {
    const content = (step.output as ToolOutput | null)?.content ?? step.error ?? "";
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }
  return null;
}

export function forkDisabledReason(
  trace: Pick<TraceRow, "provider" | "status"> & { created_at?: string },
  step: Pick<StepRow, "type"> | undefined,
  now: number = Date.now(),
): string | null {
  if (!step) return "Select a step";
  if (trace.provider === "sdk") return "Fork requires a replayable agent — this trace was ingested through the SDK";
  if (trace.status === "running" && !(trace.created_at && displayStatus({ status: trace.status, created_at: trace.created_at }, now) === "stalled")) {
    return "Wait for the trace to finish";
  }
  if (step.type === "span") return "Span steps can't be forked";
  return null;
}
