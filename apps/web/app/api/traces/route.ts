import { getRepo, projectId } from "@/lib/db";
import { parseListParams } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const repo = await getRepo();
  return Response.json(await repo.listTraces({ projectId: projectId(), ...parseListParams(sp) }));
}
