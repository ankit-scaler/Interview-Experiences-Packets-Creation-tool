import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeQuestion } from "@/lib/normalize";

export const runtime = "nodejs";

const Patch = z.object({
  displayText: z.string().min(3).max(4000).optional(),
  problemLink: z.string().url().max(500).nullable().optional().or(z.literal("")),
  order: z.number().int().optional(),
  roundId: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const data: Record<string, unknown> = {};
  if (parsed.data.displayText !== undefined) {
    data.displayText = parsed.data.displayText;
    data.editedByAdmin = true;
    data.normalizedText = normalizeQuestion(parsed.data.displayText);
  }
  if (parsed.data.problemLink !== undefined) {
    data.problemLink = parsed.data.problemLink || null;
    data.problemLinkSource = parsed.data.problemLink ? "MANUAL" : null;
  }
  if (parsed.data.order !== undefined) data.order = parsed.data.order;
  if (parsed.data.roundId !== undefined) data.roundId = parsed.data.roundId;

  await db.question.update({ where: { id: params.id }, data });
  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const q = await db.question.findUnique({ where: { id: params.id } });
  if (q) {
    await db.$transaction([
      db.question.update({ where: { id: q.id }, data: { status: "REMOVED" } }),
      db.suppressedQuestion.upsert({
        where: { packetId_normalizedText: { packetId: q.packetId, normalizedText: q.normalizedText } },
        create: { packetId: q.packetId, normalizedText: q.normalizedText },
        update: {},
      }),
    ]);
  }
  return json({ ok: true });
}
