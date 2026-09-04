import type { Track } from "@prisma/client";
import { db } from "@/lib/db";
import { env, hasGoogleSheets } from "@/lib/env";
import { syncAll } from "@/lib/sync";
import { getRepoRows } from "@/lib/sheets/repo";
import { runStep } from "@/lib/generation/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Vercel Cron (nightly): refresh sheet snapshots, mirror reads/feedback, nudge stuck jobs. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Refresh the question-sheet snapshots so "Create packet" is always instant and
  // works off recent data without an on-demand download.
  const snapshots: Record<string, string> = {};
  if (hasGoogleSheets()) {
    for (const track of ["ACADEMY", "DEVOPS", "AIML", "DSML"] as Track[]) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const rows = await getRepoRows(track, { maxAgeMinutes: 0 });
        snapshots[track] = `${rows.length} rows`;
      } catch (e) {
        snapshots[track] = `error: ${e instanceof Error ? e.message : e}`;
      }
    }
  }

  // Advance jobs that stalled (e.g. a serverless timeout mid-run).
  const stuck = await db.generationJob.findMany({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    select: { id: true },
    take: 5,
  });
  for (const j of stuck) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await runStep(j.id);
    } catch {
      /* recorded on the job */
    }
  }

  const results = await syncAll();
  return Response.json({ ok: true, snapshots, advanced: stuck.length, sync: results });
}
