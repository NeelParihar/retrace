import { hashString } from "./hash";
import { decide } from "./policy";
import type { Completion, ModelProvider, ToolDef } from "./types";
import type { Msg } from "../types";

export const SIM_MODEL = "sim-1";

export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export class SimulatedProvider implements ModelProvider {
  readonly kind = "simulated" as const;
  readonly model = SIM_MODEL;

  async complete(req: { system: string; messages: Msg[]; tools: ToolDef[] }): Promise<Completion> {
    const d = decide(req.messages);
    const toolCalls = d.toolCalls.map((c, i) => ({ id: `call_${req.messages.length}_${i}`, ...c }));
    const transcript = JSON.stringify(req.messages);
    return {
      text: d.text,
      toolCalls,
      usage: {
        promptTokens: estimateTokens(req.system + JSON.stringify(req.tools) + transcript),
        completionTokens: estimateTokens((d.text ?? "") + JSON.stringify(toolCalls)) + 8,
      },
      simulatedLatencyMs: 350 + (hashString(transcript) % 1200),
    };
  }
}
