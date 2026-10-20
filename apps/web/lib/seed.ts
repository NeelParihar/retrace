import { randomUUID } from "node:crypto";
import { virtualClock } from "./agent/clock";
import { executeFork, prepareFork } from "./agent/fork";
import { startRun, type RunDeps } from "./agent/loop";
import { SimulatedProvider } from "./agent/simulated";
import type { Repo } from "./db/repo";
import { DEMO_PROJECT_ID } from "./demo";
import { processEvents } from "./ingest/process";

export const PRESET_TASKS = [
  "How many marathons laid end to end would reach the Moon?",
  "How many Eiffel Towers stacked would match Mount Everest?",
  "How long does light take to reach the Moon, in seconds?",
  "When was Python first released, and how many years ago was that?",
];

interface SeedRun {
  key?: string;
  task: string;
  name?: string;
  failFirst?: number;
  maxLlmCalls?: number;
}

const SEED_RUNS: SeedRun[] = [
  { key: "marathon", task: PRESET_TASKS[0] },
  { key: "flaky", task: "How many marathons is the Great Wall of China?", failFirst: 2 },
  { key: "light", task: PRESET_TASKS[2] },
  { task: "How tall is Mount Everest?", name: "fact-checker" },
  { task: PRESET_TASKS[1] },
  { task: "How far away is the Moon?", name: "fact-checker" },
  { task: "How many Eiffel Towers would span the Great Wall of China?" },
  { task: "At what temperature does water boil at sea level?", name: "fact-checker" },
  { task: "How many marathons laid end to end would reach the Moon, roughly?", maxLlmCalls: 2 },
  { task: PRESET_TASKS[3] },
  { task: "How many base pairs are in the human genome?" },
  { task: "Summarize recent quantum gravity results" },
  { task: "How large is the Pacific Ocean?", name: "fact-checker" },
  { task: "How tall is the Eiffel Tower?", failFirst: 1 },
  { task: "What is the speed of light?" },
  { task: "How long is a marathon?", name: "fact-checker" },
  { task: "How many marathons would cover the Great Wall of China's length?", failFirst: 1 },
  { task: "What's the latest on room-temperature superconductors?" },
  { task: "How many Eiffel Towers stacked would reach the Moon?" },
];

const MOON_EDIT = JSON.stringify(
  {
    query: PRESET_TASKS[2],
    results: [
      { title: "Speed of light", url: "https://kb.retrace.dev/speed-of-light", snippet: "Light travels at 299,792,458 metres per second in a vacuum.", value: 299_792_458, unit: "m/s", score: 2 },
      { title: "Moon at apogee", url: "https://kb.retrace.dev/moon-apogee", snippet: "At apogee the Moon is about 405,500 km away.", value: 405_500_000, unit: "m", score: 2 },
    ],
  },
  null,
  2,
);

const FORKS: { source: string; stepIndex: number; edited?: string; afterMs: number }[] = [
  { source: "marathon", stepIndex: 0, edited: "How many marathons is the Great Wall of China?", afterMs: 40 * 60_000 },
  { source: "marathon", stepIndex: 0, edited: "How many Eiffel Towers would span the Great Wall of China?", afterMs: 95 * 60_000 },
  { source: "flaky", stepIndex: 1, afterMs: 25 * 60_000 },
  { source: "flaky", stepIndex: 3, afterMs: 70 * 60_000 },
  { source: "light", stepIndex: 1, edited: MOON_EDIT, afterMs: 50 * 60_000 },
];

const DAY = 86_400_000;
const noop = () => {};

export async function seedDemo(repo: Repo, opts: { now: number; projectId?: string }): Promise<{ traceIds: string[] }> {
  const projectId = opts.projectId ?? DEMO_PROJECT_ID;
  const provider = new SimulatedProvider();
  const deps = (start: number, extra: Partial<RunDeps> = {}): RunDeps => ({ repo, provider, clock: virtualClock(start), emit: noop, ...extra });
  const traceIds: string[] = [];
  const byKey: Record<string, string> = {};

  const span = 14 * DAY - 6 * 3_600_000; // leave the last 6h for the SDK trace and slack
  for (let i = 0; i < SEED_RUNS.length; i++) {
    const r = SEED_RUNS[i];
    const start = opts.now - 14 * DAY + Math.round(((i + 0.5) * span) / SEED_RUNS.length);
    const t = await startRun(deps(start, { failFirst: r.failFirst, maxLlmCalls: r.maxLlmCalls }), { projectId, task: r.task, name: r.name });
    traceIds.push(t.id);
    if (r.key) byKey[r.key] = t.id;
  }

  for (const f of FORKS) {
    const src = await repo.getTrace(byKey[f.source]);
    if (!src) throw new Error(`seed source ${f.source} missing`);
    const prepared = await prepareFork(repo, projectId, src.id, f.stepIndex, f.edited ?? null);
    const t = await executeFork(deps(Date.parse(src.created_at) + f.afterMs), projectId, prepared);
    traceIds.push(t.id);
  }

  traceIds.push(await seedSdkTrace(repo, projectId, opts.now - 5 * 3_600_000));
  return { traceIds };
}

async function seedSdkTrace(repo: Repo, projectId: string, start: number): Promise<string> {
  const ts = (ms: number) => new Date(start + ms).toISOString();
  const traceId = randomUUID();
  const span = randomUUID();
  const kb = randomUUID();
  const gen = randomUUID();
  const { results } = await processEvents(repo, projectId, [
    { type: "trace.create", id: traceId, timestamp: ts(0), name: "support-bot", input: { question: "Can I change my delivery address after ordering?" }, metadata: { sdk: "@retrace/sdk", version: "0.1.0" } },
    { type: "step.create", id: span, traceId, timestamp: ts(0), stepType: "span", name: "retrieve-context", input: { k: 3 } },
    { type: "step.create", id: kb, traceId, parentStepId: span, timestamp: ts(12), stepType: "tool", name: "kb.search", input: { query: "change delivery address" } },
    { type: "step.end", id: kb, traceId, timestamp: ts(231), output: { hits: ["orders/editing-an-order", "shipping/address-changes"] } },
    { type: "step.end", id: span, traceId, timestamp: ts(240) },
    { type: "step.create", id: gen, traceId, timestamp: ts(250), stepType: "llm", name: "answer", model: "claude-haiku-4-5", input: { system: "You are a support agent.", question: "Can I change my delivery address after ordering?" } },
    { type: "step.end", id: gen, traceId, timestamp: ts(1840), output: { text: "Yes — until the order ships you can edit the address from Orders → Edit. After it ships, contact the carrier." }, usage: { promptTokens: 812, completionTokens: 164 } },
    { type: "trace.end", id: traceId, timestamp: ts(1850), status: "success", output: { answer: "Yes — until the order ships you can edit the address from Orders → Edit." } },
  ]);
  const failed = results.find((r) => !r.ok);
  if (failed) throw new Error(`seed SDK trace failed: ${failed.error}`);
  return traceId;
}
