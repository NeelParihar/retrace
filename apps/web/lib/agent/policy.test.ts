import { describe, expect, it } from "vitest";
import type { Msg } from "../types";
import { decide, deriveCalc, parseSearch } from "./policy";

const user = (content: string): Msg => ({ role: "user", content });
const tool = (name: string, content: string, isError = false): Msg => ({ role: "tool", toolCallId: `c-${name}`, name, content, isError });
const searchOf = (...facts: { title: string; value: number; unit: string }[]) =>
  JSON.stringify({ query: "q", results: facts.map((f) => ({ ...f, url: "u", snippet: `${f.title} snippet`, score: 1 })) });

describe("parseSearch", () => {
  it("extracts facts with numeric values", () => {
    expect(parseSearch(searchOf({ title: "A", value: 1, unit: "m" }))).toEqual([{ title: "A", snippet: "A snippet", value: 1, unit: "m" }]);
  });
  it("treats invalid JSON or shapes as no facts", () => {
    expect(parseSearch("the moon is very far")).toEqual([]);
    expect(parseSearch('{"results": "nope"}')).toEqual([]);
    expect(parseSearch('{"results": [{"title": 3}]}')).toEqual([]);
  });
});

describe("deriveCalc", () => {
  const moon = { title: "Moon", snippet: "", value: 384_400_000, unit: "m" };
  const marathon = { title: "Marathon", snippet: "", value: 42_195, unit: "m" };
  const light = { title: "Light", snippet: "", value: 299_792_458, unit: "m/s" };
  const python = { title: "Python", snippet: "", value: 1991, unit: "year" };
  it("divides same-unit facts for ratio questions", () => {
    expect(deriveCalc("How many marathons reach the Moon?", [moon, marathon])).toEqual({ expression: "384400000 / 42195", suffix: "" });
  });
  it("divides distance by speed for time questions", () => {
    expect(deriveCalc("How long does light take to reach the Moon?", [light, moon])).toEqual({ expression: "384400000 / 299792458", suffix: " seconds" });
  });
  it("subtracts from the reference year for 'years ago'", () => {
    expect(deriveCalc("When was Python released and how many years ago was that?", [python])).toEqual({ expression: "2026 - 1991", suffix: " years" });
  });
  it("returns null without a compute intent", () => {
    expect(deriveCalc("How tall is Mount Everest?", [moon, marathon])).toBeNull();
  });
});

describe("decide", () => {
  const task = "How many marathons laid end to end would reach the Moon?";
  it("searches first", () => {
    expect(decide([user(task)]).toolCalls).toEqual([{ name: "web_search", input: { query: task } }]);
  });
  it("retries a failed search once, then gives up", () => {
    const f = tool("web_search", "upstream timeout", true);
    expect(decide([user(task), f]).toolCalls[0].name).toBe("web_search");
    const giveUp = decide([user(task), f, f]);
    expect(giveUp.toolCalls).toEqual([]);
    expect(giveUp.text).toMatch(/web_search failed twice/);
  });
  it("computes, saves a note, then answers", () => {
    const s = tool("web_search", searchOf({ title: "Moon", value: 384_400_000, unit: "m" }, { title: "Marathon", value: 42_195, unit: "m" }));
    expect(decide([user(task), s]).toolCalls).toEqual([{ name: "calculator", input: { expression: "384400000 / 42195" } }]);
    const c = tool("calculator", JSON.stringify({ expression: "x", result: "9110.08413319" }));
    const n = decide([user(task), s, c]);
    expect(n.toolCalls[0]).toMatchObject({ name: "notes", input: { action: "append" } });
    const final = decide([user(task), s, c, tool("notes", '{"saved":true,"note":1}')]);
    expect(final.toolCalls).toEqual([]);
    expect(final.text).toBe("Roughly 9,110.08. Based on: Moon, Marathon.");
  });
  it("answers from a snippet when no calculation is needed", () => {
    const s = tool("web_search", searchOf({ title: "Mount Everest", value: 8849, unit: "m" }));
    const final = decide([user("How tall is Mount Everest?"), s, tool("notes", "{}")]);
    expect(final.text).toBe("Mount Everest snippet (source: Mount Everest)");
  });
  it("says so when nothing was found or the tool output is prose", () => {
    const s = tool("web_search", "I edited this into prose");
    const final = decide([user(task), s, tool("notes", "{}")]);
    expect(final.text).toBe("I couldn't find anything relevant to that in the search index.");
  });
  it("reports calculator errors in the answer", () => {
    const s = tool("web_search", searchOf({ title: "Moon", value: 1, unit: "m" }, { title: "Marathon", value: 2, unit: "m" }));
    const c = tool("calculator", "division by zero", true);
    const n = decide([user(task), s, c]);
    expect((n.toolCalls[0].input as { text: string }).text).toContain("I couldn't compute the result: division by zero.");
  });
});
