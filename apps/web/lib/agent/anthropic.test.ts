import { describe, expect, it, vi } from "vitest";
import type { Msg } from "../types";
import { AnthropicProvider, fromAnthropicResponse, toAnthropicMessages } from "./anthropic";
import { TOOL_DEFS } from "./tools";

describe("anthropic mapping", () => {
  it("maps tool calls and merges consecutive tool results into one user turn", () => {
    const msgs: Msg[] = [
      { role: "user", content: "q" },
      { role: "assistant", text: "thinking", toolCalls: [{ id: "a", name: "web_search", input: { query: "q" } }, { id: "b", name: "notes", input: {} }] },
      { role: "tool", toolCallId: "a", name: "web_search", content: "r1", isError: false },
      { role: "tool", toolCallId: "b", name: "notes", content: "r2", isError: true },
    ];
    expect(toAnthropicMessages(msgs)).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: [
        { type: "text", text: "thinking" },
        { type: "tool_use", id: "a", name: "web_search", input: { query: "q" } },
        { type: "tool_use", id: "b", name: "notes", input: {} },
      ] },
      { role: "user", content: [
        { type: "tool_result", tool_use_id: "a", content: "r1", is_error: false },
        { type: "tool_result", tool_use_id: "b", content: "r2", is_error: true },
      ] },
    ]);
  });
  it("parses text, tool_use and usage", () => {
    expect(fromAnthropicResponse({
      content: [{ type: "text", text: "Let me search." }, { type: "tool_use", id: "t1", name: "web_search", input: { query: "x" } }],
      usage: { input_tokens: 321, output_tokens: 45 },
    })).toEqual({ text: "Let me search.", toolCalls: [{ id: "t1", name: "web_search", input: { query: "x" } }], usage: { promptTokens: 321, completionTokens: 45 } });
  });
  it("throws a readable error on non-2xx", async () => {
    const fetchImpl = vi.fn(async () => new Response("overloaded", { status: 529 }));
    const p = new AnthropicProvider("k", fetchImpl as unknown as typeof fetch);
    await expect(p.complete({ system: "s", messages: [{ role: "user", content: "q" }], tools: TOOL_DEFS })).rejects.toThrow("Anthropic API 529: overloaded");
  });
});
