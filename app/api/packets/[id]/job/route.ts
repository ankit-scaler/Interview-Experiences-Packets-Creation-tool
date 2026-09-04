import { guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const job = await db.generationJob.findFirst({
    where: { packetId: params.id },
    orderBy: { startedAt: "desc" },
  });
  if (!job) return json({ job: null });

  return json({
    job: {
      id: job.id,
      kind: job.kind,
      status: job.status,
      step: job.step,
      progress: job.progress,
      stepLabel: job.stepLabel,
      error: job.error,
      log: job.log,
      stats: job.stats,
      costUsd: job.costUsd,
      inputTokens: job.inputTokens,
      outputTokens: job.outputTokens,
      cachedInputTokens: job.cachedInputTokens,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    },
  });
}
