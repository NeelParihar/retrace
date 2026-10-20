import type { LlmOutput, Msg, ToolCall } from "./types";

/**
 * Steps ingested through the SDK carry arbitrary JSON. These guards let the UI use rich views
 * only when a payload really has the demo agent's shape, and fall back to raw JSON otherwise.
 */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function isToolCall(v: unknown): v is ToolCall {
  return isObj(v) && typeof v.id === "string" && typeof v.name === "string" && isObj(v.input);
}

export function asLlmOutput(v: unknown): LlmOutput | null {
  if (!isObj(v) || !Array.isArray(v.toolCalls) || !v.toolCalls.every(isToolCall)) return null;
  if (v.text != null && typeof v.text !== "string") return null;
  return { text: (v.text as string | null | undefined) ?? null, toolCalls: v.toolCalls };
}

function isMsg(m: unknown): m is Msg {
  if (!isObj(m)) return false;
  if (m.role === "user") return typeof m.content === "string";
  if (m.role === "assistant") return (m.text == null || typeof m.text === "string") && Array.isArray(m.toolCalls) && m.toolCalls.every(isToolCall);
  if (m.role === "tool") return typeof m.name === "string" && typeof m.content === "string" && typeof m.isError === "boolean";
  return false;
}

/** The message list of an LLM step's input, if it is in the agent's format. */
export function asMessages(input: unknown): Msg[] | null {
  const messages = isObj(input) ? input.messages : undefined;
  return Array.isArray(messages) && messages.every(isMsg) ? messages : null;
}

/** A displayable error from a trace output, if there is one. */
export function errorOf(output: unknown): string | null {
  if (!isObj(output) || output.error == null) return null;
  return typeof output.error === "string" ? output.error : JSON.stringify(output.error);
}
