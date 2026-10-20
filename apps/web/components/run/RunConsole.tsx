"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDuration, pad2, shortId } from "@/lib/format";
import { answerOf, outputPreview } from "@/lib/preview";
import { streamEvents } from "@/lib/sse-client";
import { upsertStep } from "@/lib/steps";
import type { StepRow, TraceRow } from "@/lib/types";
import { StatusDot } from "../ui/StatusDot";
import { TypeTag } from "../ui/TypeTag";

type Phase = "idle" | "running" | "done" | "error";
type Mode = "simulated" | "live";

export function RunConsole({ presets, liveAvailable }: { presets: string[]; liveAvailable: boolean }) {
  const [task, setTask] = useState(presets[0]);
  const [mode, setMode] = useState<Mode>("simulated");
  const [phase, setPhase] = useState<Phase>("idle");
  const [trace, setTrace] = useState<TraceRow | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function run() {
    if (!task.trim() || phase === "running") return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase("running");
    setTrace(null);
    setSteps([]);
    setNotice(null);
    setError(null);
    let finished = false;
    try {
      await streamEvents(
        "/api/runs",
        { task, mode },
        (e) => {
          if (e.type === "trace") setTrace(e.data);
          else if (e.type === "step.start" || e.type === "step.end") setSteps((l) => upsertStep(l, e.data));
          else if (e.type === "notice") setNotice(e.data.message);
          else if (e.type === "error") setError(e.data.message);
          else if (e.type === "done") {
            finished = true;
            setTrace(e.data);
            setPhase(e.data.status === "error" ? "error" : "done");
          }
        },
        ctrl.signal,
      );
      if (!finished) throw new Error("The run was cut off before it finished — the trace may be incomplete.");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  const answer = phase === "done" && trace ? answerOf(trace.output) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section className="space-y-4">
        <div>
          <h1 className="text-[18px] font-medium">Run the demo agent</h1>
          <p className="mt-1 text-muted">
            A small research assistant with three tools — web_search, calculator and notes. Every model call and tool call is recorded as a step.
          </p>
        </div>
        <label className="block">
          <span className="label">task</span>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void run();
              }
            }}
            rows={4}
            maxLength={500}
            className="field mt-1 block w-full resize-y"
          />
        </label>
        <div>
          <div className="label mb-1">try</div>
          <ul className="space-y-1">
            {presets.map((p) => (
              <li key={p}>
                <button type="button" onClick={() => setTask(p)} className={`text-left hover:text-ink ${p === task ? "text-ink" : "text-muted"}`}>
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex" role="group" aria-label="Model">
            {(["simulated", "live"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={m === "live" && !liveAvailable}
                title={m === "live" && !liveAvailable ? "Live mode needs ANTHROPIC_API_KEY on the server" : undefined}
                onClick={() => setMode(m)}
                className={`num -ml-px h-[28px] border border-hairline px-3 text-[12px] first:ml-0 disabled:cursor-not-allowed disabled:opacity-45 ${
                  mode === m ? "bg-ink text-paper" : "bg-surface text-muted hover:text-ink"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-accent" disabled={phase === "running" || !task.trim()} onClick={run}>
            {phase === "running" ? "Running…" : "Run"}
            <kbd className="kbd border-white/40 bg-transparent text-white/80">⌘↵</kbd>
          </button>
        </div>
        <p className="text-[12px] text-muted">
          {mode === "live"
            ? "Live runs call claude-haiku-4-5 — limited to 5 per hour per visitor and $1 per day overall."
            : "Simulated runs use a deterministic local model: same task, same trace."}
        </p>
      </section>

      <section className="panel min-w-0 self-start">
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
          <span className="label">live trace</span>
          {trace && (
            <>
              <span className="num text-muted">{shortId(trace.id)}</span>
              <span className="label rounded-[2px] border border-hairline px-1.5">{trace.provider}</span>
              <StatusDot status={trace.status} />
            </>
          )}
          {trace && phase !== "running" && (
            <Link href={`/traces/${trace.id}`} className="ml-auto text-[12px] underline decoration-hairline underline-offset-2 hover:decoration-ink">
              Open trace →
            </Link>
          )}
        </div>
        {notice && <p className="border-b border-hairline px-3 py-2 text-[12px] text-accent">{notice}</p>}
        {steps.length === 0 && phase !== "running" && (
          <p className="px-3 py-12 text-center text-muted">Pick a task and press Run. Steps show up here as they happen.</p>
        )}
        <ol>
          {steps.map((s) => (
            <li key={s.id} className="grid grid-cols-[24px_44px_110px_minmax(0,1fr)_56px] items-center gap-2 border-b border-hairline px-3 py-1.5">
              <span className="num text-[11px] text-muted">{pad2(s.idx)}</span>
              <TypeTag type={s.type} />
              <span className={`truncate ${s.error ? "text-error" : ""}`}>{s.name}</span>
              <span className="num truncate text-[12px] text-muted">{outputPreview(s, 140)}</span>
              <span className="num text-right text-[11px] text-muted">
                {s.ended_at ? formatDuration(Date.parse(s.ended_at) - Date.parse(s.started_at)) : "…"}
              </span>
            </li>
          ))}
        </ol>
        {phase === "running" && <p className="label px-3 py-2">running…</p>}
        {answer && (
          <div className="px-3 py-3">
            <span className="label mr-3">answer</span>
            {answer}
          </div>
        )}
        {error && <p className="px-3 py-2 text-error">{error}</p>}
      </section>
    </div>
  );
}
