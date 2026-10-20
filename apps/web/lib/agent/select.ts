import type { Repo } from "../db/repo";
import { checkLiveAllowed } from "../limits";
import { AnthropicProvider } from "./anthropic";
import { realClock, type Clock } from "./clock";
import { SimulatedProvider } from "./simulated";
import type { ModelProvider } from "./types";

/** Simulated runs spend a quarter of their reported latency so streaming feels live but fast. */
export const SIM_TIME_SCALE = 0.25;

type Env = Record<string, string | undefined>;

export function liveAvailable(env: Env = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

export async function selectProvider(opts: {
  mode: "simulated" | "live";
  repo: Repo;
  ipHash: string;
  now: number;
  env?: Env;
}): Promise<{ provider: ModelProvider; notice: string | null }> {
  const env = opts.env ?? process.env;
  const sim = new SimulatedProvider();
  if (opts.mode === "simulated") return { provider: sim, notice: null };
  if (!liveAvailable(env)) {
    return { provider: sim, notice: "Live mode isn't configured on this deployment — running in Simulated mode." };
  }
  const allowed = await checkLiveAllowed(opts.repo, opts.ipHash, opts.now);
  if (!allowed.ok) return { provider: sim, notice: allowed.reason };
  return { provider: new AnthropicProvider(env.ANTHROPIC_API_KEY!), notice: null };
}

export function clockFor(provider: ModelProvider): Clock {
  return realClock(provider.kind === "simulated" ? SIM_TIME_SCALE : 1);
}
