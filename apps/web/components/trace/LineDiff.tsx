import { diffLines } from "@/lib/diff";

const ROW = {
  same: "text-muted",
  add: "bg-[color-mix(in_srgb,var(--tool)_14%,transparent)]",
  del: "bg-[color-mix(in_srgb,var(--error)_10%,transparent)] text-muted line-through decoration-[color-mix(in_srgb,var(--error)_40%,transparent)]",
} as const;
const SIGN = { same: " ", add: "+", del: "−" } as const;

export function LineDiff({ a, b }: { a: string; b: string }) {
  return (
    <pre className="num max-h-[220px] overflow-auto rounded-[2px] border border-hairline text-[12px] leading-[1.5]">
      {diffLines(a, b).map((l, i) => (
        <div key={i} className={`whitespace-pre-wrap break-all ${ROW[l.op]}`}>
          <span className="inline-block w-5 select-none text-center no-underline">{SIGN[l.op]}</span>
          {l.text || " "}
        </div>
      ))}
    </pre>
  );
}
