import type { StepType } from "@/lib/types";

const COLOR: Record<StepType, string> = {
  llm: "text-llm border-llm",
  tool: "text-tool border-tool",
  span: "text-span border-span",
};

export function TypeTag({ type }: { type: StepType }) {
  return (
    <span className={`num inline-flex h-[16px] w-[40px] shrink-0 items-center justify-center rounded-[2px] border text-[10px] uppercase tracking-wider ${COLOR[type]}`}>
      {type === "llm" ? "model" : type}
    </span>
  );
}
