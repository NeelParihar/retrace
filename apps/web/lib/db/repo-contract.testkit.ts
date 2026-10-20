import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { newTraceRow } from "../traces";
import type { StepRow, TraceRow } from "../types";
import type { Repo } from "./repo";

export interface ContractEnv {
  repo: Repo;
  projectId: string;
  knownKeyHash: string;
}

export function makeStep(traceId: string, idx: number, extra: Partial<StepRow> = {}): StepRow {
  return {
    id: randomUUID(),
    trace_id: traceId,
    parent_step_id: null,
    idx,
    type: "tool",
    name: `step-${idx}`,
    input: { i: idx },
    output: null,
    model: null,
    prompt_tokens: 0,
    completion_tokens: 0,
    cost: 0,
    started_at: new Date(Date.UTC(2026, 0, 1, 0, 0, idx)).toISOString(),
    ended_at: null,
    error: null,
    metadata: {},
    ...extra,
  };
}

/** Shared behaviour every Repo implementation must satisfy. Names are tagged so it can run against a live DB. */
export function runRepoContract(label: string, setup: () => Promise<ContractEnv>) {
  describe(`Repo contract: ${label}`, () => {
    let env: ContractEnv;
    const tag = `contract-${randomUUID().slice(0, 8)}`;
    const trace = (minute: number, extra: Partial<TraceRow> = {}): TraceRow => ({
      ...newTraceRow({
        id: randomUUID(),
        project_id: env.projectId,
        name: `${tag}-${minute}`,
        input: { task: `task for ${tag}` },
        provider: "simulated",
        created_at: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
      }),
      ...extra,
    });

    beforeAll(async () => {
      env = await setup();
    });

    it("inserts a trace once and reads it back", async () => {
      const t = trace(1);
      expect(await env.repo.insertTrace(t)).toBe(true);
      expect(await env.repo.insertTrace(t)).toBe(false);
      expect(await env.repo.getTrace(t.id)).toEqual(t);
      expect(await env.repo.getTrace(randomUUID())).toBeNull();
    });

    it("merges updates", async () => {
      const t = trace(2);
      await env.repo.insertTrace(t);
      await env.repo.updateTrace(t.id, { status: "error", total_cost: 0.5, output: { error: "x" } });
      expect(await env.repo.getTrace(t.id)).toMatchObject({ status: "error", total_cost: 0.5, output: { error: "x" }, name: t.name });
    });

    it("lists newest first with search, status filter and cursor paging", async () => {
      const q = `${tag}-page`;
      const a = trace(10, { name: `${q}-a` });
      const b = trace(11, { name: `${q}-b`, status: "error" });
      const c = trace(12, { name: `${q}-c` });
      for (const t of [a, b, c]) await env.repo.insertTrace(t);

      const p1 = await env.repo.listTraces({ projectId: env.projectId, q, limit: 2 });
      expect(p1.items.map((t) => t.id)).toEqual([c.id, b.id]);
      expect(p1.nextCursor).toBe(b.created_at);

      const p2 = await env.repo.listTraces({ projectId: env.projectId, q, limit: 2, cursor: p1.nextCursor });
      expect(p2.items.map((t) => t.id)).toEqual([a.id]);
      expect(p2.nextCursor).toBeNull();

      const errors = await env.repo.listTraces({ projectId: env.projectId, q, status: "error", limit: 10 });
      expect(errors.items.map((t) => t.id)).toEqual([b.id]);
    });

    it("search also matches the task text, case-insensitively", async () => {
      const needle = `Zebra${randomUUID().slice(0, 6)}`;
      const t = trace(20, { input: { task: `find the ${needle} please` } });
      await env.repo.insertTrace(t);
      const res = await env.repo.listTraces({ projectId: env.projectId, q: needle.toLowerCase(), limit: 10 });
      expect(res.items.map((x) => x.id)).toEqual([t.id]);
    });

    it("lists traces since a timestamp", async () => {
      const old = trace(30, { created_at: "2001-01-01T00:00:00.000Z" });
      const recent = trace(31);
      await env.repo.insertTrace(old);
      await env.repo.insertTrace(recent);
      const ids = (await env.repo.listTracesSince(env.projectId, "2025-12-31T00:00:00.000Z")).map((t) => t.id);
      expect(ids).toContain(recent.id);
      expect(ids).not.toContain(old.id);
    });

    it("stores steps idempotently, updates them and returns them by idx", async () => {
      const t = trace(40);
      await env.repo.insertTrace(t);
      const s1 = makeStep(t.id, 1);
      const s0 = makeStep(t.id, 0, { type: "llm", model: "sim-1" });
      expect(await env.repo.insertStep(s1)).toBe(true);
      expect(await env.repo.insertStep(s0)).toBe(true);
      expect(await env.repo.insertStep(s0)).toBe(false);
      await env.repo.updateStep(s1.id, { output: { ok: 1 }, ended_at: "2026-01-01T00:00:05.000Z" });
      const steps = await env.repo.getSteps(t.id);
      expect(steps.map((s) => s.idx)).toEqual([0, 1]);
      expect(steps[1]).toMatchObject({ output: { ok: 1 }, ended_at: "2026-01-01T00:00:05.000Z" });
      expect(await env.repo.getStep(s0.id)).toEqual(s0);
    });

    it("returns forks of a trace", async () => {
      const parent = trace(50);
      const fork = trace(51, { parent_trace_id: parent.id, forked_from_step_index: 2 });
      await env.repo.insertTrace(parent);
      await env.repo.insertTrace(fork);
      expect((await env.repo.getForks(parent.id)).map((t) => t.id)).toEqual([fork.id]);
    });

    it("rate limits per window", async () => {
      const ip = `ip-${randomUUID()}`;
      const w = "2026-01-01T10:00:00.000Z";
      expect(await env.repo.hitRateLimit(ip, w, 2)).toBe(true);
      expect(await env.repo.hitRateLimit(ip, w, 2)).toBe(true);
      expect(await env.repo.hitRateLimit(ip, w, 2)).toBe(false);
      expect(await env.repo.hitRateLimit(ip, "2026-01-01T11:00:00.000Z", 2)).toBe(true);
    });

    it("accumulates live usage per day", async () => {
      const day = `1990-01-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`;
      const before = await env.repo.getLiveUsage(day);
      await env.repo.addLiveUsage(day, 0.25);
      await env.repo.addLiveUsage(day, 0.5);
      const after = await env.repo.getLiveUsage(day);
      expect(after.live_runs - before.live_runs).toBe(2);
      expect(after.live_cost - before.live_cost).toBeCloseTo(0.75, 6);
    });

    it("exposes pricing and finds projects by key hash", async () => {
      expect((await env.repo.getPricing()).map((p) => p.model)).toContain("sim-1");
      expect(await env.repo.findProjectByKeyHash(env.knownKeyHash)).toMatchObject({ id: env.projectId });
      expect(await env.repo.findProjectByKeyHash("nope")).toBeNull();
    });
  });
}
