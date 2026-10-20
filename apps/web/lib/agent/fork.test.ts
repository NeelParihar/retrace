import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepo } from "../db";
import type { MemoryRepo } from "../db/memory";
import { DEMO_PROJECT_ID } from "../demo";
import { newTraceRow } from "../traces";
import type { LlmInput, TraceRow } from "../types";
import { virtualClock } from "./clock";
import { executeFork, prepareFork } from "./fork";
import { editableTextFor, forkDisabledReason, ForkError, planFork } from "./fork-plan";
import { startRun, type RunDeps } from "./loop";
import { SimulatedProvider } from "./simulated";

const MOON = "How many marathons laid end to end would reach the Moon?";
let repo: MemoryRepo;
let deps: RunDeps;
let source: TraceRow;

beforeEach(async () => {
  repo = createMemoryRepo();
  deps = { repo, provider: new SimulatedProvider(), clock: virtualClock(Date.parse("2026-10-01T10:00:00Z")), emit: () => {} };
  source = await startRun(deps, { projectId: DEMO_PROJECT_ID, task: MOON });
});

const fork = async (stepIndex: number, edited: string | null = null) =>
  executeFork(deps, DEMO_PROJECT_ID, await prepareFork(repo, DEMO_PROJECT_ID, source.id, stepIndex, edited));

describe("planFork", () => {
  it("rebuilds message state from the copied prefix", async () => {
    const steps = await repo.getSteps(source.id);
    const plan = planFork(steps, 3, null);
    expect(plan.copy.map((s) => s.idx)).toEqual([0, 1, 2]);
    expect(plan.target.name).toBe("calculator");
    expect(plan.state.messages.map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant"]);
    expect(plan.state.pending.map((c) => c.name)).toEqual(["calculator"]);
  });

  it("rejects out-of-range indices and span steps", async () => {
    const steps = await repo.getSteps(source.id);
    expect(() => planFork(steps, 99, null)).toThrow(ForkError);
    expect(() => planFork(steps, -1, null)).toThrow(/out of range/);
    expect(() => planFork([{ ...steps[0], type: "span" }], 0, null)).toThrow(/span/i);
  });

  it("refuses to fork past a failed model step", async () => {
    const steps = await repo.getSteps(source.id);
    const broken = steps.map((s) => (s.idx === 0 ? { ...s, output: null, error: "boom" } : s));
    expect(() => planFork(broken, 2, null)).toThrow(/failed model step/);
  });

  it("exposes editable text per step type", async () => {
    const steps = await repo.getSteps(source.id);
    expect(editableTextFor(steps[0])).toBe(MOON);
    expect(editableTextFor(steps[1])).toContain('"results"');
    expect(editableTextFor(steps[1])).toContain("\n"); // pretty-printed JSON
  });

  it("explains why fork is disabled", () => {
    expect(forkDisabledReason({ provider: "sdk", status: "success" }, { type: "llm" })).toMatch(/replayable agent/);
    expect(forkDisabledReason({ provider: "simulated", status: "running" }, { type: "llm" })).toMatch(/finish/);
    expect(forkDisabledReason({ provider: "simulated", status: "success" }, { type: "span" })).toMatch(/Span/);
    expect(forkDisabledReason({ provider: "simulated", status: "success" }, { type: "tool" })).toBeNull();
  });
});

describe("prepareFork", () => {
  it("returns 404, 422 and 409 for missing, SDK and running traces", async () => {
    await expect(prepareFork(repo, DEMO_PROJECT_ID, "00000000-0000-4000-8000-00000000dead", 0, null)).rejects.toMatchObject({ status: 404 });
    const sdk = newTraceRow({ id: "00000000-0000-4000-8000-0000000000c1", project_id: DEMO_PROJECT_ID, name: "sdk", input: null, provider: "sdk", created_at: "2026-10-01T00:00:00.000Z" });
    await repo.insertTrace({ ...sdk, status: "success" });
    await expect(prepareFork(repo, DEMO_PROJECT_ID, sdk.id, 0, null)).rejects.toMatchObject({ status: 422 });
    const running = { ...sdk, id: "00000000-0000-4000-8000-0000000000c2", provider: "simulated" as const, status: "running" as const };
    await repo.insertTrace(running);
    await expect(prepareFork(repo, DEMO_PROJECT_ID, running.id, 0, null)).rejects.toMatchObject({ status: 409 });
    await expect(prepareFork(repo, "00000000-0000-4000-8000-0000000000ff", source.id, 0, null)).rejects.toMatchObject({ status: 404 });
  });
});

describe("executeFork", () => {
  it("copies the prefix, links lineage and re-runs from the step", async () => {
    const f = await fork(3);
    const steps = await repo.getSteps(f.id);
    expect(f).toMatchObject({ parent_trace_id: source.id, forked_from_step_index: 3, status: "success", step_count: 7 });
    expect(steps.slice(0, 3).every((s) => (s.metadata.copied_from as { trace_id: string }).trace_id === source.id)).toBe(true);
    expect(steps[3].metadata.copied_from).toBeUndefined();
    expect(f.output).toEqual(source.output);
    expect(await repo.getForks(source.id)).toHaveLength(1);
  });

  it("re-bases copied steps so the fork's timeline is contiguous", async () => {
    const f = await fork(3);
    const steps = await repo.getSteps(f.id);
    expect(Date.parse(steps[0].started_at)).toBe(Date.parse(f.created_at));
    expect(Date.parse(steps[2].ended_at!)).toBeLessThanOrEqual(Date.parse(steps[3].started_at));
  });

  it("applies an edited user message at step #00 and stores the new task", async () => {
    const f = await fork(0, "How tall is Mount Everest?");
    expect(f.input).toEqual({ task: "How tall is Mount Everest?" });
    expect((f.output as { answer: string }).answer).toContain("8,849");
    const [first] = await repo.getSteps(f.id);
    expect((first.input as LlmInput).messages[0]).toEqual({ role: "user", content: "How tall is Mount Everest?" });
    expect(f.metadata).toMatchObject({ edited: true, forked_from: source.id });
  });

  it("applies an edited tool output without executing the tool", async () => {
    const edited = JSON.stringify({ query: "q", results: [
      { title: "Moon (hypothetical)", snippet: "", value: 1_000_000_000, unit: "m" },
      { title: "Marathon distance", snippet: "", value: 42_195, unit: "m" },
    ] });
    const f = await fork(1, edited);
    const steps = await repo.getSteps(f.id);
    expect(steps[1]).toMatchObject({ name: "web_search", output: { content: edited, isError: false }, metadata: { edited: true } });
    expect((f.output as { answer: string }).answer).toBe("Roughly 23,699.49. Based on: Moon (hypothetical), Marathon distance.");
  });

  it("survives a tool output edited into prose", async () => {
    const f = await fork(1, "the moon is really far away");
    expect(f.status).toBe("success");
    expect((f.output as { answer: string }).answer).toBe("I couldn't find anything relevant to that in the search index.");
  });
});
