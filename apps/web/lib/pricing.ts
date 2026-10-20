import type { ModelPrice } from "./types";

export const DEFAULT_PRICING: ModelPrice[] = [
  { model: "sim-1", input_per_mtok: 1, output_per_mtok: 5 },
  { model: "claude-haiku-4-5", input_per_mtok: 1, output_per_mtok: 5 },
  { model: "claude-haiku-4-5-20251001", input_per_mtok: 1, output_per_mtok: 5 },
  { model: "gpt-4o-mini", input_per_mtok: 0.15, output_per_mtok: 0.6 },
];

export function computeCost(
  prices: ModelPrice[],
  model: string | null,
  promptTokens: number,
  completionTokens: number,
): { cost: number; known: boolean } {
  if (!model) return { cost: 0, known: promptTokens + completionTokens === 0 };
  const p = prices.find((x) => x.model === model);
  if (!p) return { cost: 0, known: false };
  const cost = (promptTokens * p.input_per_mtok + completionTokens * p.output_per_mtok) / 1_000_000;
  return { cost: Math.round(cost * 1e6) / 1e6, known: true };
}
