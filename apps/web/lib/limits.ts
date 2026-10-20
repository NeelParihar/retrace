import type { Repo } from "./db/repo";
import { sha256Hex } from "./hash";

export const LIVE_RUNS_PER_HOUR = 5;
export const LIVE_DAILY_CAP_USD = 1;
/** Agent runs + forks per IP per hour, any mode (each one writes a trace and ~10 steps). */
export const RUNS_PER_HOUR = 30;
export const INGEST_REQUESTS_PER_HOUR = 300;
export const INGEST_MAX_BYTES = 512_000;

export function clientIpHash(req: Request): string {
  const ip =
    req.headers.get("x-nf-client-connection-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return sha256Hex(`${process.env.IP_HASH_SALT ?? "retrace-dev"}:${ip}`);
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);
const hourWindow = (now: number) => new Date(Math.floor(now / 3_600_000) * 3_600_000).toISOString();

export async function checkLiveAllowed(repo: Repo, ipHash: string, now: number): Promise<{ ok: true } | { ok: false; reason: string }> {
  const usage = await repo.getLiveUsage(dayOf(now));
  if (usage.live_cost >= LIVE_DAILY_CAP_USD) {
    return { ok: false, reason: `Live mode's daily budget ($${LIVE_DAILY_CAP_USD.toFixed(2)}) is used up — running in Simulated mode.` };
  }
  if (!(await repo.hitRateLimit(ipHash, hourWindow(now), LIVE_RUNS_PER_HOUR))) {
    return { ok: false, reason: `Live mode is limited to ${LIVE_RUNS_PER_HOUR} runs per hour — running in Simulated mode.` };
  }
  return { ok: true };
}

/** Counts one request against a per-IP hourly bucket; false once the bucket is over max. */
export async function checkRateLimit(repo: Repo, bucket: string, ipHash: string, max: number, now: number): Promise<boolean> {
  return repo.hitRateLimit(`${bucket}:${ipHash}`, hourWindow(now), max);
}

export function tooManyRequests(what: string): Response {
  return Response.json({ error: `Too many ${what} from your network — try again in an hour.` }, { status: 429 });
}

export async function recordLiveUsage(repo: Repo, now: number, cost: number): Promise<void> {
  await repo.addLiveUsage(dayOf(now), cost);
}
