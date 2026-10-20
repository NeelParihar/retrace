import { notFound } from "next/navigation";
import { CompareView } from "@/components/compare/CompareView";
import { getRepo, projectId } from "@/lib/db";
import { getTraceDetail } from "@/lib/traces";

export const dynamic = "force-dynamic";

export default async function ComparePage({ params }: { params: Promise<{ id: string; otherId: string }> }) {
  const { id, otherId } = await params;
  const repo = await getRepo();
  const [left, right] = await Promise.all([getTraceDetail(repo, projectId(), id), getTraceDetail(repo, projectId(), otherId)]);
  if (!left || !right) notFound();
  return <CompareView left={left} right={right} />;
}
