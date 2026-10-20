import { randomUUID } from "node:crypto";
import type { Repo } from "../db/repo";
import { computeCost } from "../pricing";
import type { ModelPrice, StepRow, StepType, Usage } from "../types";
import type { Clock } from "./clock";
import type { AgentEvent } from "./types";

const iso = (ms: number) => new Date(ms).toISOString();

/** Writes steps for one trace, prices them, and emits step events. */
export class Recorder {
  private idx = 0;
  llmCount = 0;

  constructor(
    private repo: Repo,
    private prices: ModelPrice[],
    private clock: Clock,
    private emit: (e: AgentEvent) => void,
    readonly traceId: string,
  ) {}

  async record(
    spec: { type: StepType; name: string; input: unknown; model?: string | null; metadata?: Record<string, unknown> },
    fn: () => Promise<{ output: unknown; usage?: Usage; error?: string | null }>,
  ): Promise<StepRow> {
    const step: StepRow = {
      id: randomUUID(),
      trace_id: this.traceId,
      parent_step_id: null,
      idx: this.idx++,
      type: spec.type,
      name: spec.name,
      input: spec.input,
      output: null,
      model: spec.model ?? null,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost: 0,
      started_at: iso(this.clock.now()),
      ended_at: null,
      error: null,
      metadata: spec.metadata ?? {},
    };
    if (spec.type === "llm") this.llmCount++;
    await this.repo.insertStep(step);
    this.emit({ type: "step.start", data: step });

    let result: { output: unknown; usage?: Usage; error?: string | null };
    try {
      result = await fn();
    } catch (e) {
      result = { output: null, error: e instanceof Error ? e.message : String(e) };
    }
    const prompt_tokens = result.usage?.promptTokens ?? 0;
    const completion_tokens = result.usage?.completionTokens ?? 0;
    const priced = computeCost(this.prices, step.model, prompt_tokens, completion_tokens);
    const patch: Partial<StepRow> = {
      output: result.output ?? null,
      prompt_tokens,
      completion_tokens,
      cost: priced.cost,
      ended_at: iso(this.clock.now()),
      error: result.error ?? null,
      metadata: priced.known ? step.metadata : { ...step.metadata, unpriced_model: true },
    };
    await this.repo.updateStep(step.id, patch);
    const done = { ...step, ...patch };
    this.emit({ type: "step.end", data: done });
    return done;
  }

  /** Copies a step from another trace, shifting its timestamps by offsetMs. */
  async copy(src: StepRow, offsetMs: number): Promise<StepRow> {
    const shift = (v: string | null) => (v == null ? null : iso(Date.parse(v) + offsetMs));
    const step: StepRow = {
      ...structuredClone(src),
      id: randomUUID(),
      trace_id: this.traceId,
      parent_step_id: null,
      started_at: shift(src.started_at)!,
      ended_at: shift(src.ended_at),
      metadata: {
        ...src.metadata,
        copied_from: { step_id: src.id, trace_id: src.trace_id, started_at: src.started_at, ended_at: src.ended_at },
      },
    };
    await this.repo.insertStep(step);
    this.idx = src.idx + 1;
    if (src.type === "llm") this.llmCount++;
    this.emit({ type: "step.end", data: step });
    return step;
  }
}
