# Retrace — Agent Observability & Replay

**Date:** 2026-10-20
**Status:** Approved design, pending spec review
**Owner:** Neel Parihar

## 1. Purpose

A Langfuse-style observability product for LLM agents, built as a resume showcase. It traces every agent step, LLM call, tool call, token count and cost; replays a trace step by step; and lets a user **fork a trace from step N** — edit that step's input and re-run the agent from there as a new, linked trace.

**Success criteria**

- A recruiter opening the Netlify URL sees populated, realistic data within 2 seconds and can replay and fork a trace without signing up.
- The repo reads as a real product: monorepo with an SDK, typed API, migrations, tests, a strong README.
- The UI looks like a hand-built developer tool, not an AI-generated template (see §7).

## 2. Architecture

- **App:** Next.js 15 (App Router, TypeScript, Tailwind CSS v4), deployed on Netlify via the Next.js runtime.
- **Database:** Supabase Postgres. Accessed only server-side (route handlers / server components) with the service-role key. No client-side DB access; RLS enabled with no public policies.
- **Monorepo:** pnpm workspace.
  - `apps/web` — the Next.js app.
  - `packages/sdk` — `@retrace/sdk`, a dependency-free TypeScript client.
- **Demo agent:** `apps/web/lib/agent` — a small "research assistant" loop with 3 tools: `calculator`, `web_search` (stubbed, canned corpus), `notes` (in-run scratchpad). Max 8 steps per run.
- **Model providers:** a `ModelProvider` interface with:
  - `SimulatedProvider` (default) — deterministic given a seed + messages; produces plausible tool-call decisions, text, token counts (from a char-based estimate) and latency.
  - `AnthropicProvider` — enabled only when `ANTHROPIC_API_KEY` is set; model `claude-haiku-4-5-20251001`.
  - Hybrid mode: the UI shows a toggle "Simulated / Live" only when Live is available. Live runs are guarded by a per-IP limit (5 runs/hour) and a global daily cost cap ($1/day, tracked in `usage_daily`). On limit or cap, the run falls back to Simulated and the UI states why.

## 3. Data model (Postgres)

```
projects        (id uuid pk, name text, api_key_hash text unique, created_at)
model_pricing   (model text pk, input_per_mtok numeric, output_per_mtok numeric)
traces          (id uuid pk, project_id fk, name text, status text check in ('running','success','error'),
                 input jsonb, output jsonb, metadata jsonb,
                 total_tokens int, total_cost numeric(12,6), latency_ms int,
                 parent_trace_id uuid null fk traces, forked_from_step_index int null,
                 provider text check in ('simulated','live','sdk'),
                 created_at timestamptz, ended_at timestamptz)
steps           (id uuid pk, trace_id fk on delete cascade, parent_step_id uuid null, idx int,
                 type text check in ('llm','tool','span'), name text,
                 input jsonb, output jsonb, model text null,
                 prompt_tokens int, completion_tokens int, cost numeric(12,6),
                 started_at timestamptz, ended_at timestamptz, error text null,
                 unique(trace_id, idx))
usage_daily     (day date pk, live_cost numeric, live_runs int)
rate_limits     (ip_hash text, window_start timestamptz, count int, pk(ip_hash, window_start))
```

- Cost is computed **server-side** from `model_pricing` × token counts; SDK sends tokens only. Unknown model → cost 0, flagged in metadata.
- Trace totals are recomputed when a trace ends (sum over steps).
- Indexes: `traces(project_id, created_at desc)`, `steps(trace_id, idx)`.

## 4. API

All JSON, validated with Zod.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/ingest` | `Authorization: Bearer <project key>` | Batch of events: `trace.create`, `trace.end`, `step.create`, `step.end`. Idempotent on client-supplied UUIDs. Returns per-event results `{id, ok, error?}` with status 207 if any failed. |
| GET | `/api/traces` | public (demo project) | Query: `q`, `status`, `cursor`, `limit` (≤50). |
| GET | `/api/traces/:id` | public | Trace + ordered steps + parent/children fork links. |
| POST | `/api/traces/:id/fork` | public, rate-limited | Body `{stepIndex, editedInput?}`. Streams SSE. |
| POST | `/api/runs` | public, rate-limited | Body `{task, mode}`. Starts the demo agent; streams SSE. |
| GET | `/api/stats` | public | Totals, p50/p95 latency, cost per day (last 14 days). |

**SSE event shape:** `{type: 'trace'|'step.start'|'step.end'|'done'|'error'|'notice', data}`.

### Fork semantics

1. Load source trace; require `0 ≤ stepIndex < steps.length` and that the trace was produced by the demo agent (`provider` ∈ simulated/live). SDK-ingested traces show the fork button disabled with a tooltip "Fork requires a replayable agent".
2. Create new trace with `parent_trace_id`, `forked_from_step_index = N`.
3. Copy steps `0..N-1` verbatim (new ids, same idx, original timestamps kept in `metadata.copied_from`).
4. Rebuild the agent's message history from copied steps. If `editedInput` is provided it replaces step N's input (for an `llm` step: the last user/tool message; for a `tool` step: the tool's output fed back to the model).
5. Resume the agent loop from step N, streaming new steps.

## 5. SDK (`@retrace/sdk`)

```ts
const rt = new Retrace({ apiKey, baseUrl });
const trace = rt.trace({ name: 'support-bot', input });
const gen = trace.generation({ name: 'plan', model: 'claude-haiku-4-5', input });
gen.end({ output, usage: { promptTokens, completionTokens } });
const tool = trace.tool({ name: 'search', input }); tool.end({ output });
await trace.end({ output });   // flushes
```

- Buffers events, flushes on `end()` or every 1s/20 events; retries ×3 with backoff; never throws into user code (logs a warning).
- Ships with an `examples/node-agent.ts` script that sends a trace to the deployed instance.

## 6. UI

Routes:

- `/` — **Traces.** Header strip: total traces, tokens, cost, p50 latency, and a 14-day cost sparkline. Dense table: status dot, name, steps, tokens, cost, latency, age; fork badge `⑂ from #N` on forked traces. Search + status filter; keyboard `j/k` to move, `enter` to open.
- `/traces/[id]` — **Trace detail.** Three panes:
  - Left: step list/tree (index, type glyph, name, duration).
  - Center: waterfall timeline (bars aligned on real timestamps).
  - Right: inspector for the selected step — Input / Output / Usage tabs, JSON with syntax highlighting, copy button.
  - Top bar: **Replay** controls (play/pause, step back/forward, speed 1×/2×/4×, scrubber). During replay, steps after the cursor are dimmed and running token/cost counters tick up.
  - Each step row: **Fork from here** → side sheet with the step's input in an editor, original vs edited diff, "Run fork" → streams into a new trace and navigates to it live.
  - Lineage: breadcrumb to parent; list of child forks; `/traces/[id]/compare/[otherId]` shows parent vs fork side by side with the divergence point marked.
- `/run` — **Run the demo agent.** Task input with 4 preset prompts, mode toggle (Live shown only if available), live streaming of steps.
- `/settings` — demo project API key (public, demo-only), SDK install + snippet, pricing table.

## 7. Visual direction — "authentic, not AI-generated"

Explicit rules to avoid the generic AI-template look:

- **No:** purple/indigo gradients, glassmorphism, glowing blobs, emoji in UI, sparkle icons, oversized rounded cards with soft drop-shadows, hero sections with taglines, "✨ AI-powered" copy, centered landing-page layout.
- **Typography:** IBM Plex Sans for UI, IBM Plex Mono for all numbers, IDs, tokens, costs, durations and JSON (tabular numerals). Small, deliberate type scale (12/13/14/18px); uppercase 11px mono labels with letter-spacing for section headers.
- **Palette (light):** warm paper background `#F5F3EE`, surface `#FBFAF7`, ink `#1C1B18`, muted ink `#6B675E`, hairline `#E2DED4`. Single accent: signal vermilion `#D9481E` (used sparingly: active step, fork action, replay cursor). Step-type colors, muted: llm `#3D5A80`, tool `#5B7F4A`, span `#8A7A5C`; error `#B3261E`.
- **Palette (dark):** background `#141412`, surface `#1B1A17`, ink `#ECE8DF`, hairline `#2C2A25`, same accent.
- **Shape & density:** 1px hairline borders instead of shadows; radii 2–4px; tight 4px spacing grid; information-dense tables like a terminal/instrument panel. Square status dots, not pills.
- **Details that signal craft:** keyboard hints rendered as `kbd`; mono timestamps with relative age; subtle grid/ruler ticks on the waterfall; a small hand-drawn-feel wordmark set in mono (`retrace_`); no stock illustrations; empty states written in plain, specific language.
- **Motion:** minimal — 120ms fades; replay cursor slides; no bouncy animations.
- Hand-written components (Tailwind + Radix primitives where needed); no default shadcn theme.

## 8. Seeding

`pnpm seed` creates the demo project (key printed and stored in env) and ~25 traces using the SimulatedProvider over varied tasks, spread over the last 14 days, including: tool errors with recovery, a max-steps failure, long multi-tool runs, and 3 fork families (parent + 1–2 forks) so lineage/compare is demoable immediately.

## 9. Error handling

- Failed steps persist `error`; shown in error color in list, waterfall and inspector.
- Agent run exceptions mark the trace `error` and emit SSE `error`.
- Ingest: per-event validation errors don't fail the batch.
- Live limits → SSE `notice` + automatic Simulated fallback.
- Unknown routes/IDs → plain 404 page in the same visual style.

## 10. Testing

- **Vitest (unit):** cost computation; SimulatedProvider determinism; agent loop (tool dispatch, max steps); fork (step copying, history rebuild, edited input application); ingest Zod schemas and idempotency; SDK buffering/flush/retry (mocked fetch).
- **Playwright (smoke, local against seeded DB):** traces list → open trace → replay one step → fork from step 2 → new trace appears with parent link.

## 11. Delivery

- Public GitHub repo `NeelParihar/retrace`, README with screenshot/GIF, architecture diagram, feature list, local setup, SDK usage.
- New Supabase project (free tier) via connector; SQL migrations committed in `supabase/migrations`.
- Netlify site linked to the GitHub repo (auto-deploy on push to `main`); env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RETRACE_DEMO_PROJECT_ID`, optional `ANTHROPIC_API_KEY`, `IP_HASH_SALT`.

## 12. Out of scope

Auth / multi-user / multi-project UI, Python SDK, npm publishing, OpenTelemetry ingestion, evaluations/scoring, prompt management.
