import { getRepo, projectId } from "@/lib/db";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = Date.now();
  const traces = await (await getRepo()).listTracesSince(projectId(), new Date(now - 14 * 86_400_000).toISOString());
  return Response.json(computeStats(traces, now));
}
