import type { Msg } from "../types";

/** The simulated model's brain: a deterministic function of the conversation so far. */

export const REFERENCE_YEAR = 2026;

export interface Fact {
  title: string;
  snippet: string;
  value: number;
  unit: string;
}

type Decision = { text: string | null; toolCalls: { name: string; input: Record<string, unknown> }[] };
type ToolMsg = Extract<Msg, { role: "tool" }>;

export function parseSearch(content: string): Fact[] {
  let body: unknown;
  try {
    body = JSON.parse(content);
  } catch {
    return [];
  }
  const results = (body as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((r): Fact[] => {
    const x = r as Record<string, unknown>;
    if (typeof x?.title !== "string" || typeof x.value !== "number" || typeof x.unit !== "string") return [];
    return [{ title: x.title, snippet: typeof x.snippet === "string" ? x.snippet : "", value: x.value, unit: x.unit }];
  });
}

export function deriveCalc(task: string, facts: Fact[]): { expression: string; suffix: string } | null {
  if (/years? ago|years since/i.test(task)) {
    const year = facts.find((f) => f.unit === "year");
    return year ? { expression: `${REFERENCE_YEAR} - ${year.value}`, suffix: " years" } : null;
  }
  if (!/how many|how long (does|would)|ratio|times/i.test(task) || facts.length < 2) return null;
  const [a, b] = facts;
  if (a.unit === b.unit) {
    const [big, small] = a.value >= b.value ? [a, b] : [b, a];
    return { expression: `${big.value} / ${small.value}`, suffix: "" };
  }
  if (b.unit === `${a.unit}/s`) return { expression: `${a.value} / ${b.value}`, suffix: " seconds" };
  if (a.unit === `${b.unit}/s`) return { expression: `${b.value} / ${a.value}`, suffix: " seconds" };
  return null;
}

const call = (text: string, name: string, input: Record<string, unknown>): Decision => ({ text, toolCalls: [{ name, input }] });
const final = (text: string): Decision => ({ text, toolCalls: [] });

function fmt(result: string): string {
  const n = Number(result);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : result;
}

function composeAnswer(facts: Fact[], calc: { suffix: string } | null, calcMsg: ToolMsg | undefined): string {
  if (calc && calcMsg) {
    if (calcMsg.isError) return `I couldn't compute the result: ${calcMsg.content}.`;
    let result = calcMsg.content;
    try {
      result = String((JSON.parse(calcMsg.content) as { result?: unknown }).result ?? calcMsg.content);
    } catch {
      /* edited into plain text — use as-is */
    }
    return `Roughly ${fmt(result)}${calc.suffix}. Based on: ${facts.slice(0, 2).map((f) => f.title).join(", ")}.`;
  }
  if (facts.length > 0) return `${facts[0].snippet} (source: ${facts[0].title})`;
  return "I couldn't find anything relevant to that in the search index.";
}

export function decide(messages: Msg[]): Decision {
  const first = messages[0];
  const task = first?.role === "user" ? first.content : "";
  const tools = messages.filter((m): m is ToolMsg => m.role === "tool");
  const searches = tools.filter((m) => m.name === "web_search");
  const last = tools[tools.length - 1];

  if (last?.name === "web_search" && last.isError) {
    if (searches.filter((s) => s.isError).length < 2) {
      return call("The search failed; retrying once.", "web_search", { query: task });
    }
    return final(`I couldn't complete this: web_search failed twice (${last.content}).`);
  }
  if (searches.length === 0) return call(`Searching for background on "${task}".`, "web_search", { query: task });

  const okSearch = [...searches].reverse().find((s) => !s.isError);
  const facts = okSearch ? parseSearch(okSearch.content) : [];
  const calc = deriveCalc(task, facts);
  const calcMsg = tools.find((m) => m.name === "calculator");
  if (calc && !calcMsg) {
    const names = facts.slice(0, 2).map((f) => f.title).join(" and ");
    return call(`I have ${names}; computing ${calc.expression}.`, "calculator", { expression: calc.expression });
  }

  const answer = composeAnswer(facts, calc, calcMsg);
  if (!tools.some((m) => m.name === "notes")) {
    return call("Saving the result to notes before answering.", "notes", { action: "append", text: `Q: ${task}\nA: ${answer}` });
  }
  return final(answer);
}
