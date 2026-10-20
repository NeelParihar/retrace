import { describe, expect, it } from "vitest";
import { parseSseChunk } from "./sse-client";

describe("parseSseChunk", () => {
  it("parses complete events and keeps the partial tail", () => {
    const buf = `data: {"type":"notice","data":{"message":"a"}}\n\ndata: {"type":"err`;
    const { events, rest } = parseSseChunk(buf);
    expect(events).toEqual([{ type: "notice", data: { message: "a" } }]);
    expect(rest).toBe(`data: {"type":"err`);
  });
});
