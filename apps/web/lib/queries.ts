import { z } from "zod";
import type { TraceStatus } from "./types";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseListParams(sp: Record<string, string | string[] | undefined>): {
  q?: string;
  status?: TraceStatus;
  cursor?: string | null;
  limit: number;
} {
  const out: { q?: string; status?: TraceStatus; cursor?: string | null; limit: number } = { limit: 25 };
  const q = first(sp.q)?.trim().slice(0, 100);
  if (q) out.q = q;
  const status = z.enum(["running", "success", "error"]).safeParse(first(sp.status));
  if (status.success) out.status = status.data;
  const cursor = z.string().datetime({ offset: true }).safeParse(first(sp.cursor));
  if (cursor.success) out.cursor = cursor.data;
  const limit = Number(first(sp.limit));
  if (Number.isInteger(limit) && limit > 0) out.limit = Math.min(limit, 50);
  return out;
}
