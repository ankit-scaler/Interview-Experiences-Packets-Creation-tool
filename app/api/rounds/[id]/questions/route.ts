import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeQuestion } from "@/lib/normalize";
import { activityPacketByRound, logActivity, truncate } from "@/lib/activity";

export const runtime = "nodejs";

const Body = z.object({
  text: z.string().min(3).max(4000),
  problemLink: z.string().url().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Question text required");

  const round = await db.round.findUnique({
    where: { id: params.id },
    include: { questions: { select: { id: true } } },
  });
  if (!round) return apiError("Round not found", 404);

  const question = await db.question.create({
    data: {
      packetId: round.packetId,
      roundId: round.id,
      order: round.questions.length,
      source: "MANUAL",
      originalText: parsed.data.text,
      improvedText: parsed.data.text,
      displayText: parsed.data.text,
      editedByAdmin: true,
      normalizedText: normalizeQuestion(parsed.data.text),
      problemLink: parsed.data.problemLink || null,
      problemLinkSource: parsed.data.problemLink ? "MANUAL" : null,
    },
  });
  await logActivity({
    actorEmail: guard.user.email,
    action: "QUESTION_ADDED",
    packet: await activityPacketByRound(params.id),
    detail: `${round.name}: ${truncate(parsed.data.text)}`,
  });
  return json({ question });
}
