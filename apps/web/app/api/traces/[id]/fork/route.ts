import { z } from "zod";
import { executeFork, prepareFork } from "@/lib/agent/fork";
import { ForkError } from "@/lib/agent/fork-plan";
import { clockFor, selectProvider } from "@/lib/agent/select";
import { getRepo, projectId } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { checkRateLimit, clientIpHash, recordLiveUsage, RUNS_PER_HOUR, tooManyRequests } from "@/lib/limits";
import { sseStream } from "@/lib/sse";

export const dynamic = "force-dynamic";

const body = z.object({
  stepIndex: z.number().int().min(0),
  editedInput: z.string().max(20_000).transform((s) => s.replace(/\u0000/g, "")).nullable().optional(),
  mode: z.enum(["simulated", "live"]).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "trace not found" }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "expected { stepIndex: integer ≥ 0, editedInput?: string }" }, { status: 400 });

  const repo = await getRepo();
  const pid = projectId();
  const ipHash = clientIpHash(req);
  if (!(await checkRateLimit(repo, "run", ipHash, RUNS_PER_HOUR, Date.now()))) return tooManyRequests("runs");
  let prepared;
  try {
    prepared = await prepareFork(repo, pid, id, parsed.data.stepIndex, parsed.data.editedInput ?? null);
  } catch (e) {
    if (e instanceof ForkError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const now = Date.now();
  const mode = parsed.data.mode ?? (prepared.source.provider === "live" ? "live" : "simulated");
  const { provider, notice } = await selectProvider({ mode, repo, ipHash, now });

  return sseStream(async (emit) => {
    if (notice) emit({ type: "notice", data: { message: notice } });
    const trace = await executeFork({ repo, provider, clock: clockFor(provider), emit }, pid, prepared);
    if (provider.kind === "live") await recordLiveUsage(repo, now, trace.total_cost);
  });
}
