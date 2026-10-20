import { notFound } from "next/navigation";
import { TraceView } from "@/components/trace/TraceView";
import { getRepo, projectId } from "@/lib/db";
import { getTraceDetail } from "@/lib/traces";

export const dynamic = "force-dynamic";

export default async function TracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getTraceDetail(await getRepo(), projectId(), id);
  if (!detail) notFound();
  return <TraceView key={detail.trace.id} detail={detail} now={Date.now()} />;
}
