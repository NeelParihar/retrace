"use client";

import { formatDuration, pad2 } from "@/lib/format";
import type { StepRow } from "@/lib/types";
import { TypeTag } from "../ui/TypeTag";

export function StepList(props: {
  steps: StepRow[];
  selected: number;
  onSelect: (i: number) => void;
  cursor: number;
  replaying: boolean;
}) {
  const { steps, selected, onSelect, cursor, replaying } = props;
  return (
    <div className="panel min-w-0">
      <div className="label border-b border-hairline px-3 py-2">steps · {steps.length}</div>
      {steps.length === 0 ? (
        <p className="px-3 py-6 text-muted">No steps recorded yet.</p>
      ) : (
        <ol className="max-h-[70vh] overflow-auto">
          {steps.map((s, i) => {
            const dur = s.ended_at ? Date.parse(s.ended_at) - Date.parse(s.started_at) : null;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  aria-current={i === selected}
                  aria-label={`Step #${pad2(s.idx)} ${s.name}`}
                  className={`flex h-[30px] w-full items-center gap-2 border-l-2 px-3 text-left transition-opacity duration-[120ms] ${
                    i === selected ? "border-accent bg-wash" : "border-transparent hover:bg-wash"
                  } ${replaying && i > cursor ? "opacity-25" : ""}`}
                >
                  <span className="num w-5 shrink-0 text-[11px] text-muted">{pad2(s.idx)}</span>
                  <TypeTag type={s.type} />
                  <span className={`truncate ${s.error ? "text-error" : ""}`}>{s.name}</span>
                  {Boolean(s.metadata.copied_from) && <span className="label shrink-0 text-[10px]">copied</span>}
                  {Boolean(s.metadata.edited) && <span className="label shrink-0 text-[10px] text-accent">edited</span>}
                  <span className="num ml-auto shrink-0 text-[11px] text-muted">{dur == null ? "…" : formatDuration(dur)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
