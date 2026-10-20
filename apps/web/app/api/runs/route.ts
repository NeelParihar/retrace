import { z } from "zod";
import { startRun } from "@/lib/agent/loop";
import { clockFor, selectProvider } from "@/lib/agent/select";
import { getRepo, projectId } from "@/lib/db";
import { clientIpHash, recordLiveUsage } from "@/lib/limits";
import { sseStream } from "@/lib/sse";

export const dynamic = "force-dynamic";

const body = z.object({
  task: z.string().trim().min(1).max(500),
  mode: z.enum(["simulated", "live"]).default("simulated"),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "task is required (1–500 characters)" }, { status: 400 });

  const repo = await getRepo();
  const now = Date.now();
  const { provider, notice } = await selectProvider({ mode: parsed.data.mode, repo, ipHash: clientIpHash(req), now });

  return sseStream(async (emit) => {
    if (notice) emit({ type: "notice", data: { message: notice } });
    const trace = await startRun({ repo, provider, clock: clockFor(provider), emit }, { projectId: projectId(), task: parsed.data.task });
    if (provider.kind === "live") await recordLiveUsage(repo, now, trace.total_cost);
  });
}
