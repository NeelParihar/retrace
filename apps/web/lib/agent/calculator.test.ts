import { describe, expect, it } from "vitest";
import { CalcError, evaluate, formatNumber } from "./calculator";

describe("calculator", () => {
  it("respects precedence and parentheses", () => {
    expect(evaluate("2 + 3 * 4")).toBe(14);
    expect(evaluate("(2 + 3) * 4")).toBe(20);
    expect(evaluate("2 ^ 3 ^ 2")).toBe(512);
    expect(evaluate("-3 + 5")).toBe(2);
  });
  it("accepts ×, ÷, thousands separators and decimals", () => {
    expect(evaluate("1,000 × 2.5 ÷ 5")).toBe(500);
    expect(evaluate("384400000 / 42195")).toBeCloseTo(9110.084, 3);
  });
  it("rejects garbage and division by zero", () => {
    expect(() => evaluate("2 +")).toThrow(CalcError);
    expect(() => evaluate("2 $ 3")).toThrow(/unexpected token/);
    expect(() => evaluate("1 / 0")).toThrow(/division by zero/);
    expect(() => evaluate("")).toThrow(CalcError);
  });
  it("formats with 12 significant digits", () => {
    expect(formatNumber(1 / 3)).toBe("0.333333333333");
    expect(formatNumber(35)).toBe("35");
  });
});
