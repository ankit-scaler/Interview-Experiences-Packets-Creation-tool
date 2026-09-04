import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";
import { runStep } from "@/lib/generation/runner";

export const runtime = "nodejs";
// One step per call. First LOAD_SHEET on a big track can be slow; 300 is used on
// Pro, silently capped to the plan limit (60s) on Hobby — a timeout just retries.
export const maxDuration = 300;

/** Advance the packet's active generation job by exactly one step. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const retry = new URL(_req.url).searchParams.get("retry") === "1";
  const statuses = retry
    ? (["PENDING", "RUNNING", "FAILED"] as const)
    : (["PENDING", "RUNNING"] as const);

  let jobRec = await db.generationJob.findFirst({
    where: { packetId: params.id, status: { in: [...statuses] } },
    orderBy: { startedAt: "desc" },
  });
  if (!jobRec) return apiError("No active generation job for this packet.", 404);
  if (jobRec.status === "FAILED") {
    jobRec = await db.generationJob.update({
      where: { id: jobRec.id },
      data: { status: "PENDING", error: null },
    });
  }

  try {
    const step = await runStep(jobRec.id);
    const updated = await db.generationJob.findUniqueOrThrow({ where: { id: jobRec.id } });
    return json({
      jobId: updated.id,
      status: updated.status,
      step,
      progress: updated.progress,
      stepLabel: updated.stepLabel,
      done: step === "DONE",
      error: updated.error,
      costUsd: updated.costUsd,
    });
  } catch (err) {
    return json(
      {
        jobId: jobRec.id,
        status: "FAILED",
        error: err instanceof Error ? err.message : String(err),
        done: true,
      },
      500,
    );
  }
}
