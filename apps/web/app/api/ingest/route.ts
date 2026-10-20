import { getRepo } from "@/lib/db";
import { authenticate } from "@/lib/ingest/auth";
import { processEvents } from "@/lib/ingest/process";
import { ingestBody } from "@/lib/ingest/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const repo = await getRepo();
  const project = await authenticate(repo, req.headers.get("authorization"));
  if (!project) return Response.json({ error: "invalid api key" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const body = ingestBody.safeParse(json);
  if (!body.success) return Response.json({ error: "expected { batch: [1..100 events] }" }, { status: 400 });

  const { results } = await processEvents(repo, project.id, body.data.batch);
  return Response.json({ results }, { status: results.every((r) => r.ok) ? 200 : 207 });
}
