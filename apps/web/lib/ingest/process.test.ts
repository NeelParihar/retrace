import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepo } from "../db";
import type { MemoryRepo } from "../db/memory";
import { DEMO_API_KEY, DEMO_PROJECT_ID } from "../demo";
import { authenticate } from "./auth";
import { processEvents } from "./process";

let repo: MemoryRepo;
beforeEach(() => {
  repo = createMemoryRepo();
});

const ts = (s: number) => new Date(Date.UTC(2026, 9, 1, 12, 0, s)).toISOString();

function fullTrace() {
  const traceId = randomUUID();
  const span = randomUUID();
  const gen = randomUUID();
  return {
    traceId, span, gen,
    events: [
      { type: "trace.create", id: traceId, timestamp: ts(0), name: "support-bot", input: { question: "q" } },
      { type: "step.create", id: span, traceId, timestamp: ts(0), stepType: "span", name: "retrieve", input: {} },
      { type: "step.end", id: span, traceId, timestamp: ts(1) },
      { type: "step.create", id: gen, traceId, parentStepId: span, timestamp: ts(1), stepType: "llm", name: "answer", model: "claude-haiku-4-5", input: { prompt: "p" } },
      { type: "step.end", id: gen, traceId, timestamp: ts(3), output: { text: "a" }, usage: { promptTokens: 1000, completionTokens: 200 } },
      { type: "trace.end", id: traceId, timestamp: ts(4), status: "success", output: { answer: "a" } },
    ],
  };
}

describe("authenticate", () => {
  it("accepts the demo key and rejects others", async () => {
    expect(await authenticate(repo, `Bearer ${DEMO_API_KEY}`)).toMatchObject({ id: DEMO_PROJECT_ID });
    expect(await authenticate(repo, "Bearer nope")).toBeNull();
    expect(await authenticate(repo, null)).toBeNull();
  });
});

describe("processEvents", () => {
  it("ingests a full trace and prices steps server-side", async () => {
    const { traceId, gen, span, events } = fullTrace();
    const { results } = await processEvents(repo, DEMO_PROJECT_ID, events);
    expect(results.every((r) => r.ok)).toBe(true);
    const trace = await repo.getTrace(traceId);
    expect(trace).toMatchObject({ provider: "sdk", status: "success", step_count: 2, total_tokens: 1200, total_cost: 0.002, latency_ms: 4000 });
    const steps = await repo.getSteps(traceId);
    expect(steps.map((s) => s.id)).toEqual([span, gen]);
    expect(steps[1]).toMatchObject({ idx: 1, parent_step_id: span, cost: 0.002, ended_at: ts(3) });
  });

  it("is idempotent on ids", async () => {
    const { traceId, events } = fullTrace();
    await processEvents(repo, DEMO_PROJECT_ID, events);
    const again = await processEvents(repo, DEMO_PROJECT_ID, events);
    expect(again.results.every((r) => r.ok)).toBe(true);
    expect(await repo.getSteps(traceId)).toHaveLength(2);
  });

  it("flags unpriced models", async () => {
    const { traceId, gen, events } = fullTrace();
    (events[3] as { model: string }).model = "mystery-9";
    await processEvents(repo, DEMO_PROJECT_ID, events);
    expect(await repo.getStep(gen)).toMatchObject({ cost: 0, metadata: { unpriced_model: true } });
    expect((await repo.getTrace(traceId))?.total_cost).toBe(0);
  });

  it("fails bad events individually and keeps the rest", async () => {
    const { traceId, events } = fullTrace();
    const orphanStep = randomUUID();
    const batch = [
      ...events.slice(0, 1),
      { type: "step.end", id: orphanStep, traceId, timestamp: ts(1) },
      { type: "step.create", id: randomUUID(), traceId: randomUUID(), timestamp: ts(1), stepType: "tool", name: "x", input: {} },
      { type: "nonsense" },
      ...events.slice(1),
    ];
    const { results } = await processEvents(repo, DEMO_PROJECT_ID, batch);
    expect(results[1]).toMatchObject({ id: orphanStep, ok: false, error: "unknown step" });
    expect(results[2]).toMatchObject({ ok: false, error: "unknown trace" });
    expect(results[3]).toMatchObject({ id: null, ok: false });
    expect(results.filter((r) => r.ok)).toHaveLength(6);
    expect((await repo.getTrace(traceId))?.status).toBe("success");
  });

  it("will not touch another project's trace", async () => {
    const { events } = fullTrace();
    await processEvents(repo, DEMO_PROJECT_ID, events.slice(0, 1));
    const other = await processEvents(repo, "00000000-0000-4000-8000-0000000000ff", events.slice(1, 2));
    expect(other.results[0]).toMatchObject({ ok: false, error: "unknown trace" });
  });

  it("refuses to modify traces recorded by the demo agent", async () => {
    const { startRun } = await import("../agent/loop");
    const { SimulatedProvider } = await import("../agent/simulated");
    const { virtualClock } = await import("../agent/clock");
    const agent = await startRun(
      { repo, provider: new SimulatedProvider(), clock: virtualClock(Date.parse("2026-10-01T00:00:00Z")), emit: () => {} },
      { projectId: DEMO_PROJECT_ID, task: "How tall is Mount Everest?" },
    );
    const [step] = await repo.getSteps(agent.id);
    const { results } = await processEvents(repo, DEMO_PROJECT_ID, [
      { type: "step.end", id: step.id, traceId: agent.id, timestamp: ts(9), output: "vandalised" },
      { type: "trace.end", id: agent.id, timestamp: ts(9), status: "error", output: { answer: "vandalised" } },
      { type: "step.create", id: randomUUID(), traceId: agent.id, timestamp: ts(9), stepType: "tool", name: "x" },
    ]);
    expect(results.map((r) => r.error)).toEqual(Array(3).fill("trace was not created via ingest"));
    expect((await repo.getTrace(agent.id))?.output).toEqual(agent.output);
  });

  it("treats a finished trace as read-only but accepts retried events", async () => {
    const { traceId, gen, events } = fullTrace();
    await processEvents(repo, DEMO_PROJECT_ID, events);
    const retried = await processEvents(repo, DEMO_PROJECT_ID, [
      { type: "step.end", id: gen, traceId, timestamp: ts(9), output: { text: "changed" } },
      { type: "trace.end", id: traceId, timestamp: ts(9), status: "error", output: { answer: "changed" } },
    ]);
    expect(retried.results.every((r) => r.ok)).toBe(true);
    expect((await repo.getStep(gen))?.output).toEqual({ text: "a" });
    expect(await repo.getTrace(traceId)).toMatchObject({ status: "success", output: { answer: "a" } });
    const late = await processEvents(repo, DEMO_PROJECT_ID, [
      { type: "step.create", id: randomUUID(), traceId, timestamp: ts(9), stepType: "tool", name: "late" },
    ]);
    expect(late.results[0]).toMatchObject({ ok: false, error: "trace has already ended" });
  });

  it("reports a storage failure on one event without failing the batch", async () => {
    const { traceId, events } = fullTrace();
    const real = repo.insertStep.bind(repo);
    repo.insertStep = async (s) => {
      if (s.name === "answer") throw new Error("insertStep: invalid byte sequence");
      return real(s);
    };
    const { results } = await processEvents(repo, DEMO_PROJECT_ID, events);
    expect(results[3]).toMatchObject({ ok: false, error: "could not store event" });
    expect(results.filter((r) => r.ok)).toHaveLength(4);
    expect((await repo.getTrace(traceId))?.status).toBe("success");
  });

  it("strips NUL characters, which Postgres cannot store", async () => {
    const { traceId, events } = fullTrace();
    (events[0] as { input: unknown }).input = { question: "a\u0000b" };
    await processEvents(repo, DEMO_PROJECT_ID, events.slice(0, 1));
    expect((await repo.getTrace(traceId))?.input).toEqual({ question: "ab" });
  });
});
