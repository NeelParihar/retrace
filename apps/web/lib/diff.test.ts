import { describe, expect, it } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("marks changed lines", () => {
    expect(diffLines("a\nb\nc", "a\nx\nc")).toEqual([
      { op: "same", text: "a" }, { op: "del", text: "b" }, { op: "add", text: "x" }, { op: "same", text: "c" },
    ]);
  });
  it("handles identical and empty inputs", () => {
    expect(diffLines("a", "a")).toEqual([{ op: "same", text: "a" }]);
    expect(diffLines("", "x")).toEqual([{ op: "del", text: "" }, { op: "add", text: "x" }]);
  });
  it("falls back to a whole-block replace for huge inputs instead of hanging", () => {
    const big = Array.from({ length: 2000 }, (_, i) => `line ${i}`).join("\n");
    const t = Date.now();
    const out = diffLines(big, `${big}\nmore`);
    expect(Date.now() - t).toBeLessThan(500);
    expect(out.filter((l) => l.op === "add")).toHaveLength(2001);
  });
});
