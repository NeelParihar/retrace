"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useState } from "react";
import { forkDisabledReason } from "@/lib/agent/fork-plan";
import { isTypingTarget } from "@/lib/dom";
import { formatCost, formatDuration, formatTokens, pad2, relativeAge, shortId } from "@/lib/format";
import { answerOf, inputPreview } from "@/lib/preview";
import { cumulative, initReplay, replayReducer } from "@/lib/replay";
import { displayStatus } from "@/lib/status";
import type { TraceDetail } from "@/lib/traces";
import type { StepRow } from "@/lib/types";
import { KeyHints } from "../ui/KeyHints";
import { ForkSheet } from "./ForkSheet";
import { StatusDot } from "../ui/StatusDot";
import { Inspector } from "./Inspector";
import { ReplayBar } from "./ReplayBar";
import { StepList } from "./StepList";
import { Waterfall } from "./Waterfall";
import { errorOf } from "@/lib/shapes";

const link = "underline decoration-hairline underline-offset-2 hover:decoration-ink";

export function TraceView({ detail, now }: { detail: TraceDetail; now: number }) {
  const { trace, steps, parent, forks } = detail;
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [forkStep, setForkStep] = useState<StepRow | null>(null);
  const [replay, dispatch] = useReducer(replayReducer, steps.length, initReplay);
  const status = displayStatus(trace, now);
  const replaying = replay.mode === "replay";
  const step = steps[selected];
  const forkBlocked = forkDisabledReason(trace, step);

  useEffect(() => dispatch({ type: "reset", n: steps.length }), [steps.length]);

  useEffect(() => {
    if (!replay.playing) return;
    const id = setInterval(() => dispatch({ type: "tick" }), 700 / replay.speed);
    return () => clearInterval(id);
  }, [replay.playing, replay.speed]);

  useEffect(() => {
    if (replaying && replay.cursor >= 0) setSelected(replay.cursor);
  }, [replaying, replay.cursor]);

  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(id);
  }, [status, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (forkStep || isTypingTarget(e.target) || e.metaKey || e.ctrlKey) return;
      if (e.key === " ") {
        e.preventDefault();
        dispatch({ type: "toggle" });
      } else if (e.key === "ArrowRight") dispatch({ type: "next" });
      else if (e.key === "ArrowLeft") dispatch({ type: "prev" });
      else if (e.key === "j") setSelected((i) => Math.min(i + 1, steps.length - 1));
      else if (e.key === "k") setSelected((i) => Math.max(i - 1, 0));
      else if (e.key === "f" && step && !forkBlocked) setForkStep(step);
      else if (e.key === "Escape") dispatch({ type: "exit" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [forkStep, step, forkBlocked, steps.length]);

  const totals = cumulative(steps, replay.cursor);
  const answer = answerOf(trace.output);
  const error = errorOf(trace.output);
  const preview = inputPreview(trace.input, 240);
  const meta: [string, string][] = [
    ["steps", String(steps.length)],
    ["tokens", formatTokens(trace.total_tokens)],
    ["cost", formatCost(trace.total_cost)],
    ["latency", trace.latency_ms == null ? "—" : formatDuration(trace.latency_ms)],
    ["model", String(trace.metadata.model ?? steps.find((s) => s.model)?.model ?? "—")],
    ["started", relativeAge(trace.created_at, now)],
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Link href="/" className="text-muted hover:text-ink">Traces</Link>
          <span className="text-muted">/</span>
          <h1 className="text-[18px] font-medium">{trace.name}</h1>
          <span className="num text-muted">{shortId(trace.id)}</span>
          <StatusDot status={status} />
          <span className="label">{status}</span>
          <span className="label rounded-[2px] border border-hairline px-1.5">{trace.provider}</span>
        </div>
        {preview && <p className="max-w-[80ch] text-muted">{preview}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-6">
        {meta.map(([k, v]) => (
          <div key={k} className="bg-surface px-3 py-2">
            <dt className="label">{k}</dt>
            <dd className="num mt-0.5 truncate">{v}</dd>
          </div>
        ))}
      </dl>

      {(parent || forks.length > 0) && (
        <div className="panel flex flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2 text-[12px]">
          {parent && (
            <span>
              <span className="text-accent">⑂</span> forked from{" "}
              <Link className={link} href={`/traces/${parent.id}`}>
                {parent.name} <span className="num">{shortId(parent.id)}</span>
              </Link>{" "}
              at <span className="num">#{pad2(trace.forked_from_step_index)}</span> ·{" "}
              <Link className="text-muted hover:text-ink" href={`/traces/${parent.id}/compare/${trace.id}`}>compare</Link>
            </span>
          )}
          {forks.length > 0 && (
            <span className="flex flex-wrap items-center gap-x-3">
              <span>{forks.length} fork{forks.length > 1 ? "s" : ""}:</span>
              {forks.map((f) => (
                <span key={f.id}>
                  <Link className={`num ${link}`} href={`/traces/${f.id}`}>{shortId(f.id)}</Link>{" "}
                  <span className="num text-muted">from #{pad2(f.forked_from_step_index)}</span>{" "}
                  <Link className="text-muted hover:text-ink" href={`/traces/${trace.id}/compare/${f.id}`}>compare</Link>
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      {(answer || error) && (
        <div className={`panel px-3 py-2 ${error ? "text-error" : ""}`}>
          <span className="label mr-3">{error ? "error" : "answer"}</span>
          {answer ?? error}
        </div>
      )}

      <ReplayBar state={replay} dispatch={dispatch} tokens={totals.tokens} cost={totals.cost} />

      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,440px)]">
        <StepList steps={steps} selected={selected} onSelect={setSelected} cursor={replay.cursor} replaying={replaying} />
        <Waterfall steps={steps} selected={selected} onSelect={setSelected} cursor={replay.cursor} replaying={replaying} />
        <Inspector step={step} forkDisabled={forkBlocked} onFork={() => step && setForkStep(step)} />
      </div>

      <KeyHints hints={[[["space"], "play / pause"], [["←", "→"], "step"], [["j", "k"], "select"], [["f"], "fork"], [["esc"], "show all"]]} />
      {forkStep && <ForkSheet trace={trace} step={forkStep} onClose={() => setForkStep(null)} />}
    </div>
  );
}
