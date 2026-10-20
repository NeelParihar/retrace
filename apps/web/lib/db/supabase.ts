import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ModelPrice, StepRow, TraceRow } from "../types";
import type { ListQuery, Repo } from "./repo";

type Row = Record<string, unknown>;

const iso = (v: unknown) => (v == null ? null : new Date(String(v)).toISOString());
const num = (v: unknown) => Number(v ?? 0);
const obj = (v: unknown) => (v ?? {}) as Record<string, unknown>;

function toTrace(r: Row): TraceRow {
  return {
    id: String(r.id),
    project_id: String(r.project_id),
    name: String(r.name),
    status: r.status as TraceRow["status"],
    input: r.input ?? null,
    output: r.output ?? null,
    metadata: obj(r.metadata),
    step_count: num(r.step_count),
    total_tokens: num(r.total_tokens),
    total_cost: num(r.total_cost),
    latency_ms: r.latency_ms == null ? null : num(r.latency_ms),
    parent_trace_id: (r.parent_trace_id as string | null) ?? null,
    forked_from_step_index: r.forked_from_step_index == null ? null : num(r.forked_from_step_index),
    provider: r.provider as TraceRow["provider"],
    created_at: iso(r.created_at)!,
    ended_at: iso(r.ended_at),
  };
}

function toStep(r: Row): StepRow {
  return {
    id: String(r.id),
    trace_id: String(r.trace_id),
    parent_step_id: (r.parent_step_id as string | null) ?? null,
    idx: num(r.idx),
    type: r.type as StepRow["type"],
    name: String(r.name),
    input: r.input ?? null,
    output: r.output ?? null,
    model: (r.model as string | null) ?? null,
    prompt_tokens: num(r.prompt_tokens),
    completion_tokens: num(r.completion_tokens),
    cost: num(r.cost),
    started_at: iso(r.started_at)!,
    ended_at: iso(r.ended_at),
    error: (r.error as string | null) ?? null,
    metadata: obj(r.metadata),
  };
}

/** Removes characters that carry meaning in PostgREST filter syntax. */
export function sanitizeSearch(q: string): string {
  return q.replace(/[%_,()*\\"'.:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

function fail(what: string, error: PostgrestError): never {
  throw new Error(`${what}: ${error.message}`);
}

export class SupabaseRepo implements Repo {
  constructor(private db: SupabaseClient) {}

  async getPricing(): Promise<ModelPrice[]> {
    const { data, error } = await this.db.from("model_pricing").select("*").order("model");
    if (error) fail("getPricing", error);
    return (data ?? []).map((p) => ({ model: String(p.model), input_per_mtok: num(p.input_per_mtok), output_per_mtok: num(p.output_per_mtok) }));
  }

  async findProjectByKeyHash(hash: string) {
    const { data, error } = await this.db.from("projects").select("id,name").eq("api_key_hash", hash).maybeSingle();
    if (error) fail("findProjectByKeyHash", error);
    return data ? { id: String(data.id), name: String(data.name) } : null;
  }

  async insertTrace(t: TraceRow) {
    const { error } = await this.db.from("traces").insert(t);
    if (error?.code === "23505") return false;
    if (error) fail("insertTrace", error);
    return true;
  }

  async updateTrace(id: string, patch: Partial<TraceRow>) {
    const { error } = await this.db.from("traces").update(patch).eq("id", id);
    if (error) fail("updateTrace", error);
  }

  async getTrace(id: string) {
    const { data, error } = await this.db.from("traces").select("*").eq("id", id).maybeSingle();
    if (error) fail("getTrace", error);
    return data ? toTrace(data) : null;
  }

  async listTraces({ projectId, q, status, cursor, limit }: ListQuery) {
    let query = this.db.from("traces").select("*").eq("project_id", projectId);
    if (status) query = query.eq("status", status);
    const s = q ? sanitizeSearch(q) : "";
    if (s) query = query.or(`name.ilike."*${s}*",input->>task.ilike."*${s}*"`);
    if (cursor) query = query.lt("created_at", cursor);
    const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
    if (error) fail("listTraces", error);
    const rows = (data ?? []).map(toTrace);
    const items = rows.slice(0, limit);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].created_at : null };
  }

  async listTracesSince(projectId: string, sinceIso: string) {
    const { data, error } = await this.db.from("traces").select("*").eq("project_id", projectId).gte("created_at", sinceIso).limit(5000);
    if (error) fail("listTracesSince", error);
    return (data ?? []).map(toTrace);
  }

  async getForks(traceId: string) {
    const { data, error } = await this.db.from("traces").select("*").eq("parent_trace_id", traceId).order("created_at");
    if (error) fail("getForks", error);
    return (data ?? []).map(toTrace);
  }

  async insertStep(s: StepRow) {
    const { error } = await this.db.from("steps").insert(s);
    if (error?.code === "23505") return false;
    if (error) fail("insertStep", error);
    return true;
  }

  async updateStep(id: string, patch: Partial<StepRow>) {
    const { error } = await this.db.from("steps").update(patch).eq("id", id);
    if (error) fail("updateStep", error);
  }

  async getStep(id: string) {
    const { data, error } = await this.db.from("steps").select("*").eq("id", id).maybeSingle();
    if (error) fail("getStep", error);
    return data ? toStep(data) : null;
  }

  async getSteps(traceId: string) {
    const { data, error } = await this.db.from("steps").select("*").eq("trace_id", traceId).order("idx");
    if (error) fail("getSteps", error);
    return (data ?? []).map(toStep);
  }

  async hitRateLimit(ipHash: string, windowStartIso: string, max: number) {
    const { data, error } = await this.db.rpc("hit_rate_limit", { p_ip_hash: ipHash, p_window: windowStartIso, p_max: max });
    if (error) fail("hitRateLimit", error);
    return data === true;
  }

  async getLiveUsage(day: string) {
    const { data, error } = await this.db.from("usage_daily").select("live_cost,live_runs").eq("day", day).maybeSingle();
    if (error) fail("getLiveUsage", error);
    return { live_cost: num(data?.live_cost), live_runs: num(data?.live_runs) };
  }

  async addLiveUsage(day: string, cost: number) {
    const { error } = await this.db.rpc("add_live_usage", { p_day: day, p_cost: cost });
    if (error) fail("addLiveUsage", error);
  }
}
