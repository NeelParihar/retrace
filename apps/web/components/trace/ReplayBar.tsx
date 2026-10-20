"use client";

import type { Dispatch } from "react";
import { formatCost, formatTokens } from "@/lib/format";
import type { ReplayAction, ReplayState } from "@/lib/replay";

export function ReplayBar({ state, dispatch, tokens, cost }: { state: ReplayState; dispatch: Dispatch<ReplayAction>; tokens: number; cost: number }) {
  const off = state.n === 0;
  return (
    <div className="panel flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="label mr-1">replay</span>
      <button type="button" className="btn w-[28px] justify-center px-0" aria-label="Previous step" disabled={off} onClick={() => dispatch({ type: "prev" })}>←</button>
      <button type="button" className="btn min-w-[64px] justify-center" disabled={off} onClick={() => dispatch({ type: "toggle" })}>
        {state.playing ? "Pause" : "Play"}
      </button>
      <button type="button" className="btn w-[28px] justify-center px-0" aria-label="Next step" disabled={off} onClick={() => dispatch({ type: "next" })}>→</button>
      <input
        type="range"
        aria-label="Replay position"
        min={-1}
        max={Math.max(state.n - 1, -1)}
        value={state.cursor}
        disabled={off}
        onChange={(e) => dispatch({ type: "seek", index: Number(e.target.value) })}
        className="mx-2 min-w-[120px] flex-1 accent-[var(--accent)]"
      />
      <span className="num w-[52px] text-right text-muted">{state.cursor + 1}/{state.n}</span>
      <div className="flex" role="group" aria-label="Speed">
        {([1, 2, 4] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => dispatch({ type: "speed", speed: s })}
            className={`num -ml-px h-[26px] w-[32px] border border-hairline text-[11px] first:ml-0 ${state.speed === s ? "bg-ink text-paper" : "bg-surface text-muted hover:text-ink"}`}
          >
            {s}×
          </button>
        ))}
      </div>
      <span className="num ml-2 text-[12px]">
        {formatTokens(tokens)} tok · {formatCost(cost)}
      </span>
      {state.mode === "replay" && (
        <button type="button" className="btn" onClick={() => dispatch({ type: "exit" })}>
          Show all
        </button>
      )}
    </div>
  );
}
