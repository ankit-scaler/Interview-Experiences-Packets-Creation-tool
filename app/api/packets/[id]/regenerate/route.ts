import { apiError, guardAdmin, json } from "@/lib/api";
import { startGenerationJob } from "@/lib/generation/create";
import { activityPacket, logActivity } from "@/lib/activity";

export const runtime = "nodejs";

/** Kick a fresh APPEND job (pull new sheet/web questions into an existing packet). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  try {
    const job = await startGenerationJob(params.id, guard.user.id);
    await logActivity({
      actorEmail: guard.user.email,
      action: "REGENERATION_STARTED",
      packet: await activityPacket(params.id),
    });
    return json({ jobId: job.id, status: job.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(`Could not start generation: ${message}`, 500);
  }
}
