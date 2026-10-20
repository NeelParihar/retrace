import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "../db";
import { DEMO_PROJECT_ID } from "../demo";
import type { LlmInput, LlmOutput, ToolOutput } from "../types";
import { virtualClock } from "./clock";
import { startRun, type RunDeps } from "./loop";
import { SimulatedProvider } from "./simulated";
import type { AgentEvent, ModelProvider } from "./types";

function deps(over: Partial<RunDeps> = {}) {
  const events: AgentEvent[] = [];
  const d: RunDeps = {
    repo: createMemoryRepo(),
    provider: new SimulatedProvider(),
    clock: virtualClock(Date.parse("2026-10-01T10:00:00Z")),
    emit: (e) => events.push(e),
    ...over,
  };
  return { d, events };
}

describe("agent loop", () => {
  it("runs search → calculator → notes → answer and records 7 steps", async () => {
    const { d, events } = deps();
    const trace = await startRun(d, { projectId: DEMO_PROJECT_ID, task: "How many marathons laid end to end would reach the Moon?" });
    const steps = await d.repo.getSteps(trace.id);
    expect(steps.map((s) => `${s.type}:${s.name}`)).toEqual([
      "llm:model", "tool:web_search", "llm:model", "tool:calculator", "llm:model", "tool:notes", "llm:model",
    ]);
    expect(trace).toMatchObject({ status: "success", provider: "simulated", step_count: 7, output: { answer: "Roughly 9,110.08. Based on: Earth–Moon distance, Marathon distance." } });
    expect(trace.total_tokens).toBe(steps.reduce((n, s) => n + s.prompt_tokens + s.completion_tokens, 0));
    expect(trace.total_cost).toBeGreaterThan(0);
    expect(trace.latency_ms).toBeGreaterThan(0);
    expect(steps[0].model).toBe("sim-1");
    expect((steps[2].input as LlmInput).messages.map((m) => m.role)).toEqual(["user", "assistant", "tool"]);
    expect(events[0].type).toBe("trace");
    expect(events.filter((e) => e.type === "step.start")).toHaveLength(7);
    expect(events.filter((e) => e.type === "step.end")).toHaveLength(7);
    expect(events.at(-1)).toMatchObject({ type: "done", data: { id: trace.id, status: "success" } });
  });

  it("records tool failures and recovers with one retry", async () => {
    const { d } = deps({ failFirst: 1 });
    const trace = await startRun(d, { projectId: DEMO_PROJECT_ID, task: "How tall is Mount Everest?" });
    const steps = await d.repo.getSteps(trace.id);
    expect(steps[1]).toMatchObject({ name: "web_search", error: "upstream timeout after 5000ms (503)" });
    expect((steps[1].output as ToolOutput).isError).toBe(true);
    expect(steps[3]).toMatchObject({ name: "web_search", error: null });
    expect(trace.status).toBe("success");
  });

  it("stops with an error after the model-call budget", async () => {
    const { d } = deps({ maxLlmCalls: 2 });
    const trace = await startRun(d, { projectId: DEMO_PROJECT_ID, task: "How many marathons laid end to end would reach the Moon?" });
    expect(trace).toMatchObject({ status: "error", output: { error: "max model calls (2) reached" }, step_count: 4 });
  });

  it("marks the trace failed when the model throws", async () => {
    const broken: ModelProvider = { kind: "live", model: "claude-haiku-4-5-20251001", complete: async () => { throw new Error("Anthropic API 529: overloaded"); } };
    const { d, events } = deps({ provider: broken });
    const trace = await startRun(d, { projectId: DEMO_PROJECT_ID, task: "hi" });
    const [step] = await d.repo.getSteps(trace.id);
    expect(step.error).toBe("Anthropic API 529: overloaded");
    expect(trace).toMatchObject({ status: "error", provider: "live", output: { error: "Anthropic API 529: overloaded" } });
    expect(events.at(-1)?.type).toBe("done");
  });

  it("stores the assistant output on each model step", async () => {
    const { d } = deps();
    const trace = await startRun(d, { projectId: DEMO_PROJECT_ID, task: "How tall is Mount Everest?" });
    const steps = await d.repo.getSteps(trace.id);
    expect((steps[0].output as LlmOutput).toolCalls[0].name).toBe("web_search");
    expect((steps.at(-1)!.output as LlmOutput).toolCalls).toEqual([]);
  });
});
