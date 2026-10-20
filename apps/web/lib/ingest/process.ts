import type { Repo } from "../db/repo";
import { computeCost } from "../pricing";
import { finalizeTrace, newTraceRow } from "../traces";
import type { ModelPrice } from "../types";
import { ingestEvent, type IngestEvent } from "./schemas";

export interface EventResult {
  id: string | null;
  ok: boolean;
  error?: string;
}

class EventError extends Error {}

export async function processEvents(repo: Repo, projectId: string, raw: unknown[]): Promise<{ results: EventResult[] }> {
  const prices = await repo.getPricing();
  const results: EventResult[] = [];
  for (const item of raw) {
    const parsed = ingestEvent.safeParse(item);
    if (!parsed.success) {
      const id = typeof (item as { id?: unknown })?.id === "string" ? (item as { id: string }).id : null;
      results.push({ id, ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".") || "event"}: ${i.message}`).join("; ") });
      continue;
    }
    try {
      await apply(repo, projectId, prices, parsed.data);
      results.push({ id: parsed.data.id, ok: true });
    } catch (e) {
      if (!(e instanceof EventError)) throw e;
      results.push({ id: parsed.data.id, ok: false, error: e.message });
    }
  }
  return { results };
}

async function ownedTrace(repo: Repo, projectId: string, traceId: string) {
  const t = await repo.getTrace(traceId);
  if (!t || t.project_id !== projectId) throw new EventError("unknown trace");
  return t;
}

async function apply(repo: Repo, projectId: string, prices: ModelPrice[], e: IngestEvent): Promise<void> {
  switch (e.type) {
    case "trace.create": {
      const existing = await repo.getTrace(e.id);
      if (existing) {
        if (existing.project_id !== projectId) throw new EventError("unknown trace");
        return;
      }
      await repo.insertTrace(
        newTraceRow({ id: e.id, project_id: projectId, name: e.name, input: e.input ?? null, metadata: e.metadata ?? {}, provider: "sdk", created_at: new Date(e.timestamp).toISOString() }),
      );
      return;
    }
    case "step.create": {
      await ownedTrace(repo, projectId, e.traceId);
      if (await repo.getStep(e.id)) return;
      const idx = (await repo.getSteps(e.traceId)).length;
      await repo.insertStep({
        id: e.id,
        trace_id: e.traceId,
        parent_step_id: e.parentStepId ?? null,
        idx,
        type: e.stepType,
        name: e.name,
        input: e.input ?? null,
        output: null,
        model: e.model ?? null,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost: 0,
        started_at: new Date(e.timestamp).toISOString(),
        ended_at: null,
        error: null,
        metadata: {},
      });
      return;
    }
    case "step.end": {
      await ownedTrace(repo, projectId, e.traceId);
      const step = await repo.getStep(e.id);
      if (!step || step.trace_id !== e.traceId) throw new EventError("unknown step");
      const pt = e.usage?.promptTokens ?? 0;
      const ct = e.usage?.completionTokens ?? 0;
      const priced = computeCost(prices, step.model, pt, ct);
      await repo.updateStep(e.id, {
        output: e.output ?? null,
        prompt_tokens: pt,
        completion_tokens: ct,
        cost: priced.cost,
        ended_at: new Date(e.timestamp).toISOString(),
        error: e.error ?? null,
        metadata: priced.known ? step.metadata : { ...step.metadata, unpriced_model: true },
      });
      return;
    }
    case "trace.end": {
      await ownedTrace(repo, projectId, e.id);
      await finalizeTrace(repo, e.id, e.status, e.output ?? null, Date.parse(e.timestamp));
      return;
    }
  }
}
