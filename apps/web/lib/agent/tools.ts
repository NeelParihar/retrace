import type { Msg, ToolOutput } from "../types";
import { evaluate, formatNumber } from "./calculator";
import { search } from "./corpus";
import type { ToolDef } from "./types";

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "web_search",
    description: "Search the knowledge base. Returns up to 3 results with title, url, snippet and a numeric value with unit when available.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "calculator",
    description: "Evaluate an arithmetic expression using + - * / ^ and parentheses.",
    input_schema: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] },
  },
  {
    name: "notes",
    description: "Append a note to the run's scratchpad.",
    input_schema: {
      type: "object",
      properties: { action: { type: "string", enum: ["append"] }, text: { type: "string" } },
      required: ["action", "text"],
    },
  },
];

export interface ToolContext {
  history: Msg[];
  /** Make web_search fail this many times per run (deterministic flakiness for demos). */
  failFirst: number;
}

const ok = (content: string): ToolOutput => ({ content, isError: false });
const err = (content: string): ToolOutput => ({ content, isError: true });

function priorToolMsgs(history: Msg[], name: string, isError: boolean): number {
  return history.filter((m) => m.role === "tool" && m.name === name && m.isError === isError).length;
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  switch (name) {
    case "calculator": {
      const expression = String(input.expression ?? "");
      try {
        return ok(JSON.stringify({ expression, result: formatNumber(evaluate(expression)) }));
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }
    case "web_search": {
      if (priorToolMsgs(ctx.history, "web_search", true) < ctx.failFirst) {
        return err("upstream timeout after 5000ms (503)");
      }
      const query = String(input.query ?? "");
      const results = search(query).map(({ title, url, snippet, value, unit, score }) => ({ title, url, snippet, value, unit, score }));
      return ok(JSON.stringify({ query, results }));
    }
    case "notes": {
      const note = priorToolMsgs(ctx.history, "notes", false) + 1;
      return ok(JSON.stringify({ saved: true, note }));
    }
    default:
      return err(`unknown tool: ${name}`);
  }
}
