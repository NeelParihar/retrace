import { describe, expect, it } from "vitest";
import { answerOf, inputPreview, outputPreview } from "./preview";

describe("previews", () => {
  it("prefers task/question fields and clips", () => {
    expect(inputPreview({ task: "How tall is Everest?" })).toBe("How tall is Everest?");
    expect(inputPreview({ question: "q" })).toBe("q");
    expect(inputPreview({ other: 1 })).toBe('{"other":1}');
    expect(inputPreview("x".repeat(100), 10)).toBe("xxxxxxxxx…");
    expect(inputPreview(null)).toBe("");
  });
  it("summarizes step outputs by type", () => {
    expect(outputPreview({ type: "llm", output: { text: null, toolCalls: [{ id: "a", name: "web_search", input: { query: "q" } }] }, error: null })).toBe('→ web_search({"query":"q"})');
    expect(outputPreview({ type: "llm", output: { text: "Done.", toolCalls: [] }, error: null })).toBe("Done.");
    expect(outputPreview({ type: "tool", output: { content: "{\"a\":1}", isError: false }, error: null })).toBe('{"a":1}');
    expect(outputPreview({ type: "tool", output: { hits: 2 }, error: null })).toBe('{"hits":2}');
    expect(outputPreview({ type: "tool", output: null, error: "boom" })).toBe("boom");
  });
  it("extracts answers", () => {
    expect(answerOf({ answer: "a" })).toBe("a");
    expect(answerOf({ error: "e" })).toBeNull();
    expect(answerOf(null)).toBeNull();
  });
});
