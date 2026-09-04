import { notFound } from "next/navigation";
import { getPacketForEditor } from "@/lib/packets";
import { env } from "@/lib/env";
import { PacketEditor } from "@/components/packet-editor";

export const dynamic = "force-dynamic";

export default async function PacketEditorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { job?: string; append?: string };
}) {
  const packet = await getPacketForEditor(params.id);
  if (!packet) notFound();

  const costByPurpose: Record<string, number> = {};
  for (const c of packet.llmCalls) {
    costByPurpose[c.purpose] = (costByPurpose[c.purpose] ?? 0) + c.costUsd;
  }

  const latestJob = packet.jobs[0];
  const jobActive =
    Boolean(searchParams.job) ||
    (latestJob && ["PENDING", "RUNNING"].includes(latestJob.status));

  return (
    <PacketEditor
      // Remount with fresh data whenever a generation lands; stable during editing.
      key={`${packet.id}:${packet.lastGeneratedAt?.getTime() ?? 0}:${packet.rounds.length}`}
      appUrl={env.appUrl}
      llmReady={Boolean(process.env.OPENROUTER_API_KEY)}
      initialJobActive={Boolean(jobActive)}
      packet={{
        id: packet.id,
        slug: packet.slug,
        company: packet.company,
        role: packet.role,
        track: packet.track,
        yoeBucket: packet.yoeBucket,
        stack: packet.stack,
        location: packet.location,
        status: packet.status,
        sourceMode: packet.sourceMode,
        allowHigherCost: packet.allowHigherCost,
        jdSummary: packet.jdSummary,
        lifetimeCostUsd: packet.lifetimeCostUsd,
        lastGeneratedAt: packet.lastGeneratedAt?.toISOString() ?? null,
        costByPurpose,
        rounds: packet.rounds.map((r) => ({
          id: r.id,
          name: r.name,
          duration: r.duration,
          isSpillover: r.isSpillover,
          questions: r.questions.map((q) => ({
            id: q.id,
            source: q.source,
            originalText: q.originalText,
            improvedText: q.improvedText,
            displayText: q.displayText,
            editedByAdmin: q.editedByAdmin,
            problemLink: q.problemLink,
            problemLinkSource: q.problemLinkSource,
            occurrences: q.occurrences,
            lastAskedAt: q.lastAskedAt?.toISOString() ?? null,
          })),
        })),
      }}
    />
  );
}
