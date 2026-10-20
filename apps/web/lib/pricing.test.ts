import { describe, expect, it } from "vitest";
import { computeCost, DEFAULT_PRICING } from "./pricing";

describe("computeCost", () => {
  it("prices prompt and completion tokens per million", () => {
    expect(computeCost(DEFAULT_PRICING, "sim-1", 1000, 200)).toEqual({ cost: 0.002, known: true });
  });
  it("returns zero and unknown for unpriced models", () => {
    expect(computeCost(DEFAULT_PRICING, "mystery-9", 1000, 200)).toEqual({ cost: 0, known: false });
  });
  it("treats steps without a model and without tokens as known zero", () => {
    expect(computeCost(DEFAULT_PRICING, null, 0, 0)).toEqual({ cost: 0, known: true });
  });
  it("rounds to 6 decimal places", () => {
    expect(computeCost(DEFAULT_PRICING, "gpt-4o-mini", 7, 3).cost).toBe(0.000003);
  });
});
