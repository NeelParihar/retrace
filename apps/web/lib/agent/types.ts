import type { Msg, StepRow, ToolCall, TraceRow, Usage } from "../types";

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface Completion {
  text: string | null;
  toolCalls: ToolCall[];
  usage: Usage;
  /** Simulated providers report latency instead of spending it; the loop sleeps on the run's clock. */
  simulatedLatencyMs?: number;
}

export interface ModelProvider {
  kind: "simulated" | "live";
  model: string;
  complete(req: { system: string; messages: Msg[]; tools: ToolDef[] }): Promise<Completion>;
}

export type AgentEvent =
  | { type: "trace"; data: TraceRow }
  | { type: "step.start"; data: StepRow }
  | { type: "step.end"; data: StepRow }
  | { type: "done"; data: TraceRow }
  | { type: "error"; data: { message: string } }
  | { type: "notice"; data: { message: string } };
