import Link from "next/link";
import { Filters } from "@/components/traces/Filters";
import { StatsStrip } from "@/components/traces/StatsStrip";
import { TraceTable } from "@/components/traces/TraceTable";
import { KeyHints } from "@/components/ui/KeyHints";
import { getRepo, projectId } from "@/lib/db";
import { parseListParams } from "@/lib/queries";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function TracesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseListParams(await searchParams);
  const repo = await getRepo();
  const pid = projectId();
  const now = Date.now();
  const [page, recent] = await Promise.all([
    repo.listTraces({ projectId: pid, ...query }),
    repo.listTracesSince(pid, new Date(now - 14 * 86_400_000).toISOString()),
  ]);

  const keep = { ...(query.q ? { q: query.q } : {}), ...(query.status ? { status: query.status } : {}) };
  const older = page.nextCursor ? `/?${new URLSearchParams({ ...keep, cursor: page.nextCursor })}` : null;
  const newest = query.cursor ? `/?${new URLSearchParams(keep)}` : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[18px] font-medium">Traces</h1>
        <Link href="/run" className="btn">
          Run the demo agent →
        </Link>
      </div>
      <StatsStrip stats={computeStats(recent, now)} />
      <Filters key={`${query.q ?? ""}|${query.status ?? ""}`} q={query.q} status={query.status} />
      <TraceTable traces={page.items} now={now} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <KeyHints hints={[[["j", "k"], "move"], [["↵"], "open"], [["/"], "search"]]} />
        <div className="flex gap-4 text-[12px]">
          {newest && <Link href={newest} className="text-muted hover:text-ink">← newest</Link>}
          {older && <Link href={older} className="text-muted hover:text-ink">older →</Link>}
        </div>
      </div>
    </div>
  );
}
