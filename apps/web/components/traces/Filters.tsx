"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isTypingTarget } from "@/lib/dom";

const STATUSES: [string, string][] = [["", "all"], ["success", "success"], ["error", "error"], ["running", "running"]];

export function Filters({ q, status }: { q?: string; status?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(q ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (next: { q?: string; status?: string }) => {
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.status) p.set("status", next.status);
    const qs = p.toString();
    router.push(qs ? `/?${qs}` : "/");
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: value.trim(), status });
        }}
      >
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
          placeholder="Search name or task"
          aria-label="Search traces"
          className="field h-[28px] w-[280px] max-w-full"
        />
      </form>
      <div className="flex" role="group" aria-label="Status filter">
        {STATUSES.map(([v, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => go({ q: value.trim(), status: v || undefined })}
            className={`num -ml-px h-[28px] border border-hairline px-3 text-[12px] first:ml-0 ${
              (status ?? "") === v ? "bg-ink text-paper" : "bg-surface text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
