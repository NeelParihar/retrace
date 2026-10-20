import { describe, expect, it } from "vitest";
import { MemoryRepo } from "./db/memory";
import { makeStep } from "./db/repo-contract.testkit";
import { finalizeTrace, newTraceRow, summarizeSteps } from "./traces";

const P = "00000000-0000-4000-8000-0000000000aa";

describe("traces", () => {
  it("summarizes tokens, cost and count", () => {
    const steps = [
      makeStep("t", 0, { prompt_tokens: 100, completion_tokens: 20, cost: 0.0002 }),
      makeStep("t", 1, { prompt_tokens: 50, completion_tokens: 5, cost: 0.000075 }),
    ];
    expect(summarizeSteps(steps)).toEqual({ step_count: 2, total_tokens: 175, total_cost: 0.000275 });
  });

  it("finalizes a trace with totals, status and latency", async () => {
    const repo = new MemoryRepo({ projects: [{ id: P, name: "p", api_key_hash: "h" }] });
    const t = newTraceRow({
      id: "11111111-1111-4111-8111-111111111111",
      project_id: P,
      name: "x",
      input: { task: "t" },
      provider: "simulated",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    await repo.insertTrace(t);
    await repo.insertStep(makeStep(t.id, 0, { prompt_tokens: 10, completion_tokens: 2, cost: 0.00002 }));
    const done = await finalizeTrace(repo, t.id, "success", { answer: "a" }, Date.parse("2026-01-01T00:00:01.500Z"));
    expect(done).toMatchObject({
      status: "success",
      output: { answer: "a" },
      step_count: 1,
      total_tokens: 12,
      total_cost: 0.00002,
      latency_ms: 1500,
      ended_at: "2026-01-01T00:00:01.500Z",
    });
    expect(await repo.getTrace(t.id)).toMatchObject({ status: "success", latency_ms: 1500 });
  });
});
