"use client";

import { useState } from "react";

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="panel">
      <div className="flex items-center justify-between border-b border-hairline px-3 py-1.5">
        <span className="label">{label}</span>
        <button
          type="button"
          className="btn h-[22px] px-2 text-[11px]"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="num overflow-x-auto px-3 py-2 text-[12px] leading-[1.6]">{code}</pre>
    </div>
  );
}
