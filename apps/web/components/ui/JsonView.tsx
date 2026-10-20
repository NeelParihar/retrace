"use client";

import { useMemo, useState } from "react";
import { tokenizeJson, type JsonTok } from "@/lib/json-highlight";

const CLS: Record<JsonTok["kind"], string> = {
  key: "text-ink",
  string: "text-tool",
  number: "text-llm",
  literal: "text-accent",
  punct: "text-muted",
  space: "",
};

export function JsonView({ value }: { value: unknown }) {
  const text = useMemo(() => JSON.stringify(value, null, 2) ?? "undefined", [value]);
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className="btn absolute right-0 top-0 h-[22px] px-2 text-[11px]"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
      <pre className="num whitespace-pre-wrap break-words pr-14 text-[12px] leading-[1.55]">
        {tokens.map((t, i) => (
          <span key={i} className={CLS[t.kind]}>
            {t.text}
          </span>
        ))}
      </pre>
    </div>
  );
}
