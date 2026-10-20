import type { DisplayStatus } from "@/lib/status";

const COLOR: Record<DisplayStatus, string> = {
  success: "bg-ok",
  error: "bg-error",
  running: "bg-accent",
  stalled: "bg-muted",
};

export function StatusDot({ status }: { status: DisplayStatus }) {
  return <span title={status} aria-label={status} className={`inline-block size-[7px] shrink-0 ${COLOR[status]}`} />;
}
