import { DEFAULT_PRICING } from "../pricing";
import type { ModelPrice, Project, StepRow, TraceRow } from "../types";
import type { ListQuery, Repo } from "./repo";

const clone = <T>(v: T): T => structuredClone(v);

function taskText(t: TraceRow): string {
  const input = t.input as { task?: unknown } | null;
  return typeof input?.task === "string" ? input.task : "";
}

export class MemoryRepo implements Repo {
  private traces = new Map<string, TraceRow>();
  private steps = new Map<string, StepRow>();
  private rate = new Map<string, number>();
  private usage = new Map<string, { live_cost: number; live_runs: number }>();
  private projects: Project[];
  private pricing: ModelPrice[];

  constructor(init: { projects?: Project[]; pricing?: ModelPrice[] } = {}) {
    this.projects = init.projects ?? [];
    this.pricing = init.pricing ?? DEFAULT_PRICING;
  }

  async getPricing() {
    return clone(this.pricing);
  }

  async findProjectByKeyHash(hash: string) {
    const p = this.projects.find((x) => x.api_key_hash === hash);
    return p ? { id: p.id, name: p.name } : null;
  }

  async insertTrace(t: TraceRow) {
    if (this.traces.has(t.id)) return false;
    this.traces.set(t.id, clone(t));
    return true;
  }

  async updateTrace(id: string, patch: Partial<TraceRow>) {
    const t = this.traces.get(id);
    if (!t) throw new Error(`trace ${id} not found`);
    this.traces.set(id, { ...t, ...clone(patch) });
  }

  async getTrace(id: string) {
    const t = this.traces.get(id);
    return t ? clone(t) : null;
  }

  async listTraces({ projectId, q, status, cursor, limit }: ListQuery) {
    const needle = q?.trim().toLowerCase();
    const rows = [...this.traces.values()]
      .filter((t) => t.project_id === projectId)
      .filter((t) => !status || t.status === status)
      .filter((t) => !needle || t.name.toLowerCase().includes(needle) || taskText(t).toLowerCase().includes(needle))
      .filter((t) => !cursor || t.created_at < cursor)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const items = rows.slice(0, limit).map(clone);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].created_at : null };
  }

  async listTracesSince(projectId: string, sinceIso: string) {
    return [...this.traces.values()]
      .filter((t) => t.project_id === projectId && t.created_at >= sinceIso)
      .map(clone);
  }

  async getForks(traceId: string) {
    return [...this.traces.values()]
      .filter((t) => t.parent_trace_id === traceId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(clone);
  }

  async insertStep(s: StepRow) {
    if (this.steps.has(s.id)) return false;
    this.steps.set(s.id, clone(s));
    return true;
  }

  async updateStep(id: string, patch: Partial<StepRow>) {
    const s = this.steps.get(id);
    if (!s) throw new Error(`step ${id} not found`);
    this.steps.set(id, { ...s, ...clone(patch) });
  }

  async getStep(id: string) {
    const s = this.steps.get(id);
    return s ? clone(s) : null;
  }

  async getSteps(traceId: string) {
    return [...this.steps.values()]
      .filter((s) => s.trace_id === traceId)
      .sort((a, b) => a.idx - b.idx)
      .map(clone);
  }

  async hitRateLimit(ipHash: string, windowStartIso: string, max: number) {
    const key = `${ipHash}|${windowStartIso}`;
    const n = (this.rate.get(key) ?? 0) + 1;
    this.rate.set(key, n);
    return n <= max;
  }

  async getLiveUsage(day: string) {
    return { ...(this.usage.get(day) ?? { live_cost: 0, live_runs: 0 }) };
  }

  async addLiveUsage(day: string, cost: number) {
    const u = this.usage.get(day) ?? { live_cost: 0, live_runs: 0 };
    this.usage.set(day, { live_cost: u.live_cost + cost, live_runs: u.live_runs + 1 });
  }
}
