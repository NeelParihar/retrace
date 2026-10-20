import { describe, expect, it } from "vitest";
import { sparkPath, sparkPoints } from "./sparkline";

describe("sparkline", () => {
  it("maps values into the box, max at the top", () => {
    expect(sparkPath([0, 1], 10, 10, 0)).toBe("M0.0,10.0 L10.0,0.0");
  });
  it("draws flat series along the bottom and handles one point", () => {
    expect(sparkPoints([3, 3, 3], 20, 10, 1).map(([, y]) => y)).toEqual([9, 9, 9]);
    expect(sparkPoints([5], 20, 10, 1)).toEqual([[1, 9]]);
    expect(sparkPath([], 20, 10)).toBe("");
  });
});
