"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isTypingTarget } from "@/lib/dom";
import { formatCost, formatDuration, formatTokens, pad2, relativeAge, shortId } from "@/lib/format";
import { inputPreview } from "@/lib/preview";
import { displayStatus } from "@/lib/status";
import type { TraceRow } from "@/lib/types";
import { StatusDot } from "../ui/StatusDot";

export function TraceTable({ traces, now }: { traces: TraceRow[]; now: number }) {
  const router = useRouter();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey) return;
      if (e.key === "j") setActive((a) => Math.min(a + 1, traces.length - 1));
      else if (e.key === "k") setActive((a) => Math.max(a - 1, 0));
      else if (e.key === "Enter" && traces[active]) router.push(`/traces/${traces[active].id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [traces, active, router]);

  if (traces.length === 0) {
    return (
      <div className="panel px-4 py-10 text-center text-muted">
        No traces match. Clear the filters, or{" "}
        <Link href="/run" className="text-ink underline underline-offset-2">
          run the agent
        </Link>{" "}
        to record one.
      </div>
    );
  }

  const th = "label px-3 py-2 font-normal";
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline">
            <th className={`${th} w-8`} aria-label="status" />
            <th className={th}>trace</th>
            <th className={`${th} w-[96px]`}>id</th>
            <th className={`${th} w-[64px] text-right`}>steps</th>
            <th className={`${th} w-[80px] text-right`}>tokens</th>
            <th className={`${th} w-[88px] text-right`}>cost</th>
            <th className={`${th} w-[88px] text-right`}>latency</th>
            <th className={`${th} w-[80px] text-right`}>age</th>
          </tr>
        </thead>
        <tbody>
          {traces.map((t, i) => (
            <tr
              key={t.id}
              onClick={() => router.push(`/traces/${t.id}`)}
              onMouseEnter={() => setActive(i)}
              className={`h-[34px] cursor-pointer border-b border-hairline last:border-0 ${i === active ? "bg-wash" : ""}`}
            >
              <td className="pl-3">
                <StatusDot status={displayStatus(t, now)} />
              </td>
              <td className="max-w-0 px-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-medium">{t.name}</span>
                  <span className="truncate text-muted">{inputPreview(t.input, 70)}</span>
                  {t.parent_trace_id && (
                    <span className="num shrink-0 text-[11px] text-accent">⑂ from #{pad2(t.forked_from_step_index)}</span>
                  )}
                  {t.provider !== "simulated" && (
                    <span className="label shrink-0 rounded-[2px] border border-hairline px-1 text-[10px]">{t.provider}</span>
                  )}
                </div>
              </td>
              <td className="num px-3 text-muted">{shortId(t.id)}</td>
              <td className="num px-3 text-right">{t.step_count}</td>
              <td className="num px-3 text-right">{formatTokens(t.total_tokens)}</td>
              <td className="num px-3 text-right">{formatCost(t.total_cost)}</td>
              <td className="num px-3 text-right">{t.latency_ms == null ? "—" : formatDuration(t.latency_ms)}</td>
              <td className="num px-3 text-right text-muted">{relativeAge(t.created_at, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
