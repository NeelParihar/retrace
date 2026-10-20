import { describe, expect, it } from "vitest";
import { makeStep } from "./db/repo-contract.testkit";
import { upsertStep } from "./steps";

describe("upsertStep", () => {
  it("replaces by id and keeps idx order", () => {
    const a = makeStep("t", 0);
    const b = makeStep("t", 1);
    const list = upsertStep(upsertStep([], b), a);
    expect(list.map((s) => s.idx)).toEqual([0, 1]);
    const done = { ...b, ended_at: "2026-01-01T00:00:09.000Z" };
    expect(upsertStep(list, done)[1].ended_at).toBe(done.ended_at);
    expect(upsertStep(list, done)).toHaveLength(2);
  });
});
