import { guardAdmin, json } from "@/lib/api";
import { startGenerationJob } from "@/lib/generation/create";

export const runtime = "nodejs";

/** Kick a fresh APPEND job (pull new sheet/web questions into an existing packet). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const job = await startGenerationJob(params.id, guard.user.id);
  return json({ jobId: job.id, status: job.status });
}
