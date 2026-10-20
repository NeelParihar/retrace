import { describe, expect, it } from "vitest";
import type { Msg } from "../types";
import { search } from "./corpus";
import { runTool, TOOL_DEFS } from "./tools";

const ctx = (history: Msg[] = [], failFirst = 0) => ({ history, failFirst });

describe("search", () => {
  it("ranks documents by keyword overlap", () => {
    const ids = search("How many marathons laid end to end would reach the Moon?").map((d) => d.id);
    expect(ids.slice(0, 2)).toEqual(["moon", "marathon"]);
  });
  it("returns nothing for unrelated queries", () => {
    expect(search("Summarize recent quantum gravity results")).toEqual([]);
  });
});

describe("runTool", () => {
  it("declares three tools", () => {
    expect(TOOL_DEFS.map((t) => t.name)).toEqual(["web_search", "calculator", "notes"]);
  });

  it("calculator returns JSON with the result", async () => {
    const r = await runTool("calculator", { expression: "8849 / 330" }, ctx());
    expect(r.isError).toBe(false);
    expect(JSON.parse(r.content)).toEqual({ expression: "8849 / 330", result: "26.8151515152" });
  });

  it("calculator reports parse errors as tool errors", async () => {
    const r = await runTool("calculator", { expression: "2 +" }, ctx());
    expect(r).toEqual({ isError: true, content: expect.stringMatching(/unexpected token/) });
  });

  it("web_search returns ranked results", async () => {
    const r = await runTool("web_search", { query: "How tall is Mount Everest?" }, ctx());
    const body = JSON.parse(r.content);
    expect(body.results[0]).toMatchObject({ title: "Mount Everest", value: 8849, unit: "m" });
  });

  it("web_search fails the first N calls when failFirst is set", async () => {
    const failed: Msg = { role: "tool", toolCallId: "c1", name: "web_search", content: "x", isError: true };
    expect((await runTool("web_search", { query: "moon" }, ctx([], 1))).isError).toBe(true);
    expect((await runTool("web_search", { query: "moon" }, ctx([failed], 1))).isError).toBe(false);
  });

  it("notes numbers saved notes from history", async () => {
    const saved: Msg = { role: "tool", toolCallId: "c1", name: "notes", content: "{}", isError: false };
    const r = await runTool("notes", { action: "append", text: "hi" }, ctx([saved]));
    expect(JSON.parse(r.content)).toEqual({ saved: true, note: 2 });
  });

  it("unknown tools are errors", async () => {
    expect(await runTool("rm_rf", {}, ctx())).toEqual({ isError: true, content: "unknown tool: rm_rf" });
  });
});
