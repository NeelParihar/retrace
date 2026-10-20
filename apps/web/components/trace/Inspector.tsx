"use client";

import { useState } from "react";
import { formatCost, formatDuration, pad2 } from "@/lib/format";
import { asLlmOutput, asMessages } from "@/lib/shapes";
import type { StepRow, ToolOutput } from "@/lib/types";
import { JsonView } from "../ui/JsonView";
import { TypeTag } from "../ui/TypeTag";
import { MessageList } from "./MessageList";

type Tab = "input" | "output" | "usage";

export function Inspector({ step, forkDisabled, onFork }: { step: StepRow | undefined; forkDisabled: string | null; onFork: () => void }) {
  const [tab, setTab] = useState<Tab>("input");
  if (!step) return <div className="panel px-3 py-6 text-muted">Select a step to inspect it.</div>;
  const messages = step.type === "llm" ? asMessages(step.input) : null;

  return (
    <div className="panel flex min-w-0 flex-col">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
        <span className="num text-[11px] text-muted">#{pad2(step.idx)}</span>
        <TypeTag type={step.type} />
        <span className="truncate font-medium">{step.name}</span>
        <button
          type="button"
          className="btn ml-auto shrink-0"
          disabled={Boolean(forkDisabled)}
          title={forkDisabled ?? "Copy the steps before this one into a new trace and re-run from here"}
          onClick={onFork}
        >
          <span className="text-accent">⑂</span> Fork from here
        </button>
      </div>
      {step.error && <div className="num border-b border-hairline px-3 py-2 text-[12px] text-error">{step.error}</div>}
      {Boolean(step.metadata.copied_from) && (
        <div className="border-b border-hairline px-3 py-1.5 text-[12px] text-muted">Copied from the parent trace.</div>
      )}
      <div className="flex border-b border-hairline px-1" role="tablist">
        {(["input", "output", "usage"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`label relative px-2 py-2 ${tab === t ? "text-ink" : "hover:text-ink"}`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-px bg-ink" />}
          </button>
        ))}
      </div>
      <div className="max-h-[62vh] min-h-[200px] overflow-auto p-3">
        {tab === "input" && (messages ? <MessageList messages={messages} /> : <JsonView value={step.input} />)}
        {tab === "output" && <StepOutput step={step} />}
        {tab === "usage" && <UsageTable step={step} />}
      </div>
    </div>
  );
}

function StepOutput({ step }: { step: StepRow }) {
  if (step.type === "tool") {
    const out = step.output as ToolOutput | null;
    if (out && typeof out.content === "string") {
      try {
        return <JsonView value={JSON.parse(out.content)} />;
      } catch {
        return <pre className="num whitespace-pre-wrap text-[12px]">{out.content}</pre>;
      }
    }
  }
  const out = step.type === "llm" ? asLlmOutput(step.output) : null;
  if (out) {
    return <MessageList messages={[{ role: "assistant", text: out.text, toolCalls: out.toolCalls }]} />;
  }
  return step.output == null ? <p className="text-muted">No output.</p> : <JsonView value={step.output} />;
}

function UsageTable({ step }: { step: StepRow }) {
  const dur = step.ended_at ? Date.parse(step.ended_at) - Date.parse(step.started_at) : null;
  const rows: [string, string][] = [
    ["model", step.model ?? "—"],
    ["prompt tokens", step.prompt_tokens.toLocaleString("en-US")],
    ["completion tokens", step.completion_tokens.toLocaleString("en-US")],
    ["cost", formatCost(step.cost)],
    ["started", step.started_at.replace("T", " ").slice(0, 23)],
    ["duration", dur == null ? "running" : formatDuration(dur)],
  ];
  if (step.metadata.unpriced_model) rows.push(["note", "no price for this model"]);
  return (
    <table className="w-full">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-hairline last:border-0">
            <td className="label py-1.5 pr-4">{k}</td>
            <td className="num py-1.5 text-right">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
