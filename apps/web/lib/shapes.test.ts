import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "./db";
import { outputPreview } from "./preview";
import { seedDemo } from "./seed";
import { asLlmOutput, asMessages, errorOf } from "./shapes";

describe("shape guards for untrusted (SDK-ingested) payloads", () => {
  it("accepts the agent's own LLM output shape only", () => {
    expect(asLlmOutput({ text: "hi", toolCalls: [] })).toEqual({ text: "hi", toolCalls: [] });
    expect(asLlmOutput({ text: "Yes" })).toBeNull();
    expect(asLlmOutput({ text: "x", toolCalls: [{ name: 3 }] })).toBeNull();
    expect(asLlmOutput("plain")).toBeNull();
  });
  it("accepts message lists only when every message has a known shape", () => {
    expect(asMessages({ messages: [{ role: "user", content: "q" }] })).toEqual([{ role: "user", content: "q" }]);
    expect(asMessages({ messages: [{ role: "assistant", content: "openai style" }] })).toBeNull();
    expect(asMessages({ messages: [{ role: "system", content: "s" }] })).toBeNull();
    expect(asMessages({ prompt: "p" })).toBeNull();
  });
  it("only reports string errors", () => {
    expect(errorOf({ error: "boom" })).toBe("boom");
    expect(errorOf({ error: { code: 1 } })).toBe('{"code":1}');
    expect(errorOf({ answer: "a" })).toBeNull();
    expect(errorOf(null)).toBeNull();
  });
  it("previews an LLM step whose output has no toolCalls (SDK generation)", () => {
    expect(outputPreview({ type: "llm", output: { text: "Yes — until it ships." }, error: null })).toBe('{"text":"Yes — until it ships."}');
  });
  it("previews every seeded step without throwing", async () => {
    const repo = createMemoryRepo();
    const { traceIds } = await seedDemo(repo, { now: Date.now() });
    for (const id of traceIds) for (const s of await repo.getSteps(id)) expect(() => outputPreview(s)).not.toThrow();
  });
});
