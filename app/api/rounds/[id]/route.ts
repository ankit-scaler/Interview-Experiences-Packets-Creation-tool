import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  duration: z.string().max(60).nullable().optional(),
  order: z.number().int().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid input");
  await db.round.update({ where: { id: params.id }, data: parsed.data });
  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  // Suppress every question in the round so a later APPEND won't resurrect them.
  const round = await db.round.findUnique({
    where: { id: params.id },
    include: { questions: true },
  });
  if (round) {
    await db.suppressedQuestion.createMany({
      data: round.questions.map((q) => ({ packetId: round.packetId, normalizedText: q.normalizedText })),
      skipDuplicates: true,
    });
    await db.round.delete({ where: { id: params.id } });
  }
  return json({ ok: true });
}
