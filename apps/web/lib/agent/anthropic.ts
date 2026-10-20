import type { Msg, ToolCall } from "../types";
import type { Completion, ModelProvider, ToolDef } from "./types";

export const LIVE_MODEL = "claude-haiku-4-5-20251001";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error: boolean };

export type AnthropicMessage = { role: "user" | "assistant"; content: string | Block[] };

export function toAnthropicMessages(messages: Msg[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const content: Block[] = [
        ...(m.text ? [{ type: "text" as const, text: m.text }] : []),
        ...m.toolCalls.map((c) => ({ type: "tool_use" as const, id: c.id, name: c.name, input: c.input })),
      ];
      out.push({ role: "assistant", content: content.length ? content : [{ type: "text", text: "(no content)" }] });
    } else {
      const block: Block = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content, is_error: m.isError };
      const prev = out[out.length - 1];
      if (prev?.role === "user" && Array.isArray(prev.content) && prev.content.every((b) => b.type === "tool_result")) {
        prev.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
    }
  }
  return out;
}

export function fromAnthropicResponse(json: {
  content: { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }[];
  usage: { input_tokens: number; output_tokens: number };
}): Completion {
  const text = json.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
  const toolCalls: ToolCall[] = json.content
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id!, name: b.name!, input: b.input ?? {} }));
  return { text: text || null, toolCalls, usage: { promptTokens: json.usage.input_tokens, completionTokens: json.usage.output_tokens } };
}

export class AnthropicProvider implements ModelProvider {
  readonly kind = "live" as const;
  readonly model = LIVE_MODEL;

  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch) {}

  async complete(req: { system: string; messages: Msg[]; tools: ToolDef[] }): Promise<Completion> {
    const res = await this.fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: req.system,
        tools: req.tools,
        messages: toAnthropicMessages(req.messages),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return fromAnthropicResponse(await res.json());
  }
}
