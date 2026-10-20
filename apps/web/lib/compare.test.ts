import { describe, expect, it } from "vitest";
import { makeStep } from "./db/repo-contract.testkit";
import { alignSteps, divergenceIndex } from "./compare";
import { newTraceRow } from "./traces";

const trace = (id: string, parent: string | null = null, at: number | null = null) => ({
  ...newTraceRow({ id, project_id: "p", name: "n", input: null, provider: "simulated", created_at: "2026-01-01T00:00:00.000Z", parent_trace_id: parent, forked_from_step_index: at }),
});
const steps = (traceId: string, outputs: string[]) => outputs.map((o, i) => makeStep(traceId, i, { output: { content: o, isError: false } }));

describe("compare", () => {
  it("uses fork lineage when one trace is the other's parent", () => {
    expect(divergenceIndex(trace("a"), trace("b", "a", 2), steps("a", ["1", "2", "3"]), steps("b", ["1", "2", "3"]))).toBe(2);
    expect(divergenceIndex(trace("b", "a", 1), trace("a"), [], [])).toBe(1);
  });
  it("otherwise finds the first differing step", () => {
    expect(divergenceIndex(trace("a"), trace("b"), steps("a", ["1", "2", "3"]), steps("b", ["1", "x", "3"]))).toBe(1);
    expect(divergenceIndex(trace("a"), trace("b"), steps("a", ["1"]), steps("b", ["1"]))).toBe(1);
  });
  it("aligns rows by index, padding the shorter side", () => {
    const rows = alignSteps(steps("a", ["1", "2"]), steps("b", ["1", "2", "3"]), 1);
    expect(rows.map((r) => [r.idx, Boolean(r.left), Boolean(r.right), r.diverged])).toEqual([
      [0, true, true, false], [1, true, true, true], [2, false, true, true],
    ]);
  });
});
