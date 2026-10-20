import { getRepo, projectId } from "@/lib/db";
import { getTraceDetail } from "@/lib/traces";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getTraceDetail(await getRepo(), projectId(), id);
  if (!detail) return Response.json({ error: "trace not found" }, { status: 404 });
  return Response.json(detail);
}
