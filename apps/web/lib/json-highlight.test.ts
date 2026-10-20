import { describe, expect, it } from "vitest";
import { tokenizeJson } from "./json-highlight";

describe("tokenizeJson", () => {
  it("classifies keys, strings, numbers and literals", () => {
    const toks = tokenizeJson('{"a": 1, "b": [true, "x", null, -2.5e3]}').filter((t) => t.kind !== "space");
    expect(toks.map((t) => `${t.kind}:${t.text}`)).toEqual([
      "punct:{", 'key:"a"', "punct::", "number:1", "punct:,", 'key:"b"', "punct::", "punct:[",
      "literal:true", "punct:,", 'string:"x"', "punct:,", "literal:null", "punct:,", "number:-2.5e3", "punct:]", "punct:}",
    ]);
  });
  it("round-trips the original text, including escapes", () => {
    const text = JSON.stringify({ s: 'he said "hi"\n', n: [1, 2] }, null, 2);
    expect(tokenizeJson(text).map((t) => t.text).join("")).toBe(text);
  });
});
