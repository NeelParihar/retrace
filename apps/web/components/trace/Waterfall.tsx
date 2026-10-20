"use client";

import { useMemo } from "react";
import { formatDuration, pad2 } from "@/lib/format";
import type { StepRow } from "@/lib/types";
import { layoutWaterfall } from "@/lib/waterfall";

export function Waterfall(props: {
  steps: StepRow[];
  selected: number;
  onSelect: (i: number) => void;
  cursor: number;
  replaying: boolean;
}) {
  const { steps, selected, onSelect, cursor, replaying } = props;
  const layout = useMemo(() => layoutWaterfall(steps), [steps]);
  return (
    <div className="panel min-w-0">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-2">
        <span className="label">timeline</span>
        <span className="num text-[11px] text-muted">{formatDuration(layout.totalMs)}</span>
      </div>
      <div className="relative px-3 pb-2 pt-6">
        <div className="pointer-events-none absolute inset-x-3 bottom-2 top-0">
          {layout.ticks.map((t) => (
            <div key={t.pct} className="absolute bottom-0 top-0 border-l border-dashed border-hairline" style={{ left: `${t.pct}%` }}>
              <span className={`num absolute top-1 whitespace-nowrap text-[10px] text-muted ${t.pct === 100 ? "right-1" : "left-1"}`}>{t.label}</span>
            </div>
          ))}
        </div>
        <ol className="relative">
          {steps.map((s, i) => {
            const bar = layout.bars[i];
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(i)}
                  aria-label={`Timeline #${pad2(s.idx)}`}
                  className={`relative block h-[30px] w-full transition-opacity duration-[120ms] ${replaying && i > cursor ? "opacity-15" : ""}`}
                >
                  <span
                    className={`absolute top-[11px] h-[8px] rounded-[1px] ${i === selected ? "outline outline-1 outline-offset-2 outline-ink" : ""}`}
                    style={{
                      left: `${bar.leftPct}%`,
                      width: `${bar.widthPct}%`,
                      background: s.error ? "var(--error)" : `var(--${s.type})`,
                      opacity: s.metadata.copied_from ? 0.45 : 1,
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
