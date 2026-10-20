import { describe, expect, it } from "vitest";
import { parseListParams } from "./queries";

describe("parseListParams", () => {
  it("applies defaults", () => {
    expect(parseListParams({})).toEqual({ limit: 25 });
  });
  it("parses and clamps", () => {
    expect(parseListParams({ q: "  moon ", status: "error", limit: "500", cursor: "2026-10-01T00:00:00.000Z" })).toEqual({
      q: "moon", status: "error", limit: 50, cursor: "2026-10-01T00:00:00.000Z",
    });
  });
  it("drops invalid values instead of failing", () => {
    expect(parseListParams({ status: "weird", limit: "-3", cursor: "yesterday", q: "" })).toEqual({ limit: 25 });
  });
});
