import { describe, expect, it } from "vitest";
import { formatCost, formatDuration, formatTokens, pad2, relativeAge, shortId } from "./format";

describe("format", () => {
  it("formats cost by magnitude", () => {
    expect(formatCost(0)).toBe("$0");
    expect(formatCost(0.00004)).toBe("<$0.0001");
    expect(formatCost(0.00123)).toBe("$0.0012");
    expect(formatCost(3.456)).toBe("$3.46");
  });
  it("formats tokens compactly", () => {
    expect(formatTokens(812)).toBe("812");
    expect(formatTokens(1234)).toBe("1.2k");
    expect(formatTokens(12345)).toBe("12k");
    expect(formatTokens(2_500_000)).toBe("2.5M");
  });
  it("formats durations", () => {
    expect(formatDuration(950)).toBe("950ms");
    expect(formatDuration(1234)).toBe("1.23s");
    expect(formatDuration(12_340)).toBe("12.3s");
    expect(formatDuration(75_000)).toBe("1m15s");
  });
  it("formats relative age against an explicit now", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(relativeAge("2026-10-20T11:59:30Z", now)).toBe("30s ago");
    expect(relativeAge("2026-10-20T11:15:00Z", now)).toBe("45m ago");
    expect(relativeAge("2026-10-20T07:00:00Z", now)).toBe("5h ago");
    expect(relativeAge("2026-10-17T12:00:00Z", now)).toBe("3d ago");
  });
  it("shortens ids and pads indices", () => {
    expect(shortId("1a2b3c4d-0000-4000-8000-000000000000")).toBe("1a2b3c4d");
    expect(pad2(3)).toBe("03");
    expect(pad2(null)).toBe("--");
  });
});
