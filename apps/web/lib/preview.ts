import type { LlmOutput, StepRow, ToolOutput } from "./types";

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function inputPreview(input: unknown, max = 80): string {
  if (input == null) return "";
  if (typeof input === "string") return clip(input, max);
  const o = input as Record<string, unknown>;
  for (const k of ["task", "question", "query", "prompt"]) {
    if (typeof o[k] === "string") return clip(o[k] as string, max);
  }
  return clip(JSON.stringify(input), max);
}

export function outputPreview(step: Pick<StepRow, "type" | "output" | "error">, max = 120): string {
  if (step.error) return clip(step.error, max);
  if (step.type === "llm") {
    const o = step.output as LlmOutput | null;
    if (!o) return "";
    if (o.toolCalls.length) return clip(o.toolCalls.map((c) => `→ ${c.name}(${JSON.stringify(c.input)})`).join(" "), max);
    return clip(o.text ?? "", max);
  }
  if (step.type === "tool") {
    const o = step.output as ToolOutput | null;
    if (o && typeof o.content === "string") return clip(o.content, max);
  }
  if (step.output == null) return "";
  return clip(typeof step.output === "string" ? step.output : JSON.stringify(step.output), max);
}

export function answerOf(output: unknown): string | null {
  const o = output as { answer?: unknown } | null;
  return typeof o?.answer === "string" ? o.answer : null;
}
