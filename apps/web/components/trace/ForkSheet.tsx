"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { editableTextFor } from "@/lib/agent/fork-plan";
import { formatDuration, pad2 } from "@/lib/format";
import { upsertStep } from "@/lib/steps";
import { streamEvents } from "@/lib/sse-client";
import type { StepRow, TraceRow } from "@/lib/types";
import { TypeTag } from "../ui/TypeTag";
import { LineDiff } from "./LineDiff";

type Phase = "edit" | "running" | "error";

export function ForkSheet({ trace, step, onClose }: { trace: TraceRow; step: StepRow; onClose: () => void }) {
  const router = useRouter();
  const original = editableTextFor(step);
  const [text, setText] = useState(original ?? "");
  const [phase, setPhase] = useState<Phase>("edit");
  const [log, setLog] = useState<StepRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const changed = original !== null && text !== original;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && phase !== "running" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);
  useEffect(() => () => abort.current?.abort(), []);

  async function run() {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase("running");
    setLog([]);
    setError(null);
    let finished = false;
    try {
      await streamEvents(
        `/api/traces/${trace.id}/fork`,
        { stepIndex: step.idx, editedInput: changed ? text : null },
        (e) => {
          if (e.type === "step.start" || e.type === "step.end") setLog((l) => upsertStep(l, e.data));
          else if (e.type === "notice") setNotice(e.data.message);
          else if (e.type === "error") setError(e.data.message);
          else if (e.type === "done") {
            finished = true;
            router.push(`/traces/${e.data.id}`);
          }
        },
        ctrl.signal,
      );
      if (!finished) throw new Error("The fork was cut off before it finished — the new trace may be incomplete.");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  const what =
    step.type === "llm"
      ? "Edit the last message the model saw before this step."
      : "Edit the tool result that gets fed back to the model.";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[color-mix(in_srgb,var(--ink)_18%,transparent)]" onClick={() => phase !== "running" && onClose()}>
      <aside
        role="dialog"
        aria-label="Fork trace"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[580px] flex-col border-l border-hairline bg-surface"
      >
        <header className="flex items-center gap-2 border-b border-hairline px-4 py-3">
          <span className="label text-accent">fork</span>
          <span className="num text-muted">from #{pad2(step.idx)}</span>
          <TypeTag type={step.type} />
          <span className="font-medium">{step.name}</span>
          <button type="button" className="btn ml-auto" onClick={onClose} disabled={phase === "running"}>
            Close <kbd className="kbd">esc</kbd>
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
          <p className="text-muted">
            {step.idx === 0 ? "Nothing is copied — the new trace starts here." : `Steps #00–#${pad2(step.idx - 1)} are copied into a new trace.`}{" "}
            {original !== null ? what : "This step re-runs as-is."} The agent then continues from here.
          </p>

          {original !== null && (
            <label className="block">
              <span className="label">{step.type === "llm" ? "message" : "tool result"}</span>
              <textarea
                aria-label="Edited input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={phase === "running"}
                rows={Math.min(18, Math.max(4, text.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 72)), 1)))}
                spellCheck={false}
                className="field num mt-1 block w-full resize-y text-[12px] leading-[1.5]"
              />
            </label>
          )}

          {changed && (
            <div>
              <div className="label mb-1">diff</div>
              <LineDiff a={original ?? ""} b={text} />
            </div>
          )}

          {notice && <p className="text-[12px] text-accent">{notice}</p>}

          {log.length > 0 && (
            <div>
              <div className="label mb-1">new trace</div>
              <ol className="rounded-[2px] border border-hairline">
                {log.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 border-b border-hairline px-2 py-1 last:border-0">
                    <span className="num w-5 text-[11px] text-muted">{pad2(s.idx)}</span>
                    <TypeTag type={s.type} />
                    <span className={s.error ? "text-error" : ""}>{s.name}</span>
                    {Boolean(s.metadata.copied_from) && <span className="label text-[10px]">copied</span>}
                    <span className="num ml-auto text-[11px] text-muted">
                      {s.ended_at ? formatDuration(Date.parse(s.ended_at) - Date.parse(s.started_at)) : "…"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {error && <p className="text-error">{error}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-hairline px-4 py-3">
          <span className="mr-auto text-[12px] text-muted">{changed ? "Edited" : "Unchanged — re-runs from this step"}</span>
          <button type="button" className="btn" onClick={onClose} disabled={phase === "running"}>
            Cancel
          </button>
          <button type="button" className="btn btn-accent" onClick={run} disabled={phase === "running"}>
            {phase === "running" ? "Running…" : "Run fork"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
