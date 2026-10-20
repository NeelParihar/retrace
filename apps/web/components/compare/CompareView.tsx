import Link from "next/link";
import { Fragment } from "react";
import { alignSteps, divergenceIndex } from "@/lib/compare";
import { formatCost, formatTokens, pad2, shortId } from "@/lib/format";
import { answerOf, outputPreview } from "@/lib/preview";
import type { TraceDetail } from "@/lib/traces";
import type { StepRow } from "@/lib/types";
import { TypeTag } from "../ui/TypeTag";
import { errorOf } from "@/lib/shapes";

export function CompareView({ left, right }: { left: TraceDetail; right: TraceDetail }) {
  const at = divergenceIndex(left.trace, right.trace, left.steps, right.steps);
  const rows = alignSteps(left.steps, right.steps, at);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <Link href="/" className="text-muted hover:text-ink">Traces</Link>
        <span className="text-muted">/</span>
        <h1 className="text-[18px] font-medium">Compare</h1>
        <span className="num text-muted">{at >= rows.length ? "identical steps" : `diverges at #${pad2(at)}`}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Summary d={left} />
        <Summary d={right} />
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse">
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.idx}>
                {r.idx === at && (
                  <tr>
                    <td colSpan={2} className="border-y border-accent bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-3 py-1">
                      <span className="label text-accent">diverges here</span>
                    </td>
                  </tr>
                )}
                <tr className={`border-b border-hairline align-top ${r.diverged ? "" : "text-muted"}`}>
                  <Cell step={r.left} />
                  <Cell step={r.right} divider />
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Summary({ d }: { d: TraceDetail }) {
  const answer = answerOf(d.trace.output) ?? errorOf(d.trace.output) ?? "—";
  return (
    <div className="panel px-3 py-2">
      <div className="flex items-baseline gap-2">
        <Link href={`/traces/${d.trace.id}`} className="font-medium underline decoration-hairline underline-offset-2 hover:decoration-ink">{d.trace.name}</Link>
        <span className="num text-muted">{shortId(d.trace.id)}</span>
        {d.trace.parent_trace_id && <span className="num text-[11px] text-accent">⑂ #{pad2(d.trace.forked_from_step_index)}</span>}
        <span className="num ml-auto text-[12px] text-muted">{formatTokens(d.trace.total_tokens)} tok · {formatCost(d.trace.total_cost)}</span>
      </div>
      <p className="mt-1">{answer}</p>
    </div>
  );
}

function Cell({ step, divider }: { step: StepRow | null; divider?: boolean }) {
  const cls = `px-3 py-2 ${divider ? "border-l border-hairline" : ""}`;
  if (!step) return <td className={cls}><span className="text-muted">—</span></td>;
  return (
    <td className={cls}>
      <div className="flex items-center gap-2">
        <span className="num text-[11px]">#{pad2(step.idx)}</span>
        <TypeTag type={step.type} />
        <span className={step.error ? "text-error" : ""}>{step.name}</span>
        {Boolean(step.metadata.edited) && <span className="label text-[10px] text-accent">edited</span>}
      </div>
      <p className="num mt-1 break-words text-[12px]">{outputPreview(step, 160)}</p>
    </td>
  );
}
