export type StepType = "llm" | "tool" | "span";
export type TraceStatus = "running" | "success" | "error";
export type Provider = "simulated" | "live" | "sdk";

export interface TraceRow {
  id: string;
  project_id: string;
  name: string;
  status: TraceStatus;
  input: unknown;
  output: unknown;
  metadata: Record<string, unknown>;
  step_count: number;
  total_tokens: number;
  total_cost: number;
  latency_ms: number | null;
  parent_trace_id: string | null;
  forked_from_step_index: number | null;
  provider: Provider;
  created_at: string;
  ended_at: string | null;
}

export interface StepRow {
  id: string;
  trace_id: string;
  parent_step_id: string | null;
  idx: number;
  type: StepType;
  name: string;
  input: unknown;
  output: unknown;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  cost: number;
  started_at: string;
  ended_at: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

export interface ModelPrice {
  model: string;
  input_per_mtok: number;
  output_per_mtok: number;
}

export interface Project {
  id: string;
  name: string;
  api_key_hash: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; text: string | null; toolCalls: ToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string; isError: boolean };

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

export interface LlmInput {
  messages: Msg[];
}
export interface LlmOutput {
  text: string | null;
  toolCalls: ToolCall[];
}
export interface ToolInput {
  toolCallId: string;
  args: Record<string, unknown>;
}
export interface ToolOutput {
  content: string;
  isError: boolean;
}
