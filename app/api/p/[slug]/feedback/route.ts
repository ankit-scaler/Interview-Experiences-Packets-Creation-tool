import { z } from "zod";
import { apiError, guardAuthed, json } from "@/lib/api";
import { db } from "@/lib/db";
import { syncSoon } from "@/lib/sync";

export const runtime = "nodejs";

const Body = z.object({
  stars: z.number().int().min(1).max(5),
  matched: z.enum(["YES", "PARTLY", "NO"]),
  comment: z.string().max(4000).optional(),
});

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const guard = await guardAuthed();
  if (guard.error) return guard.error;
  const email = guard.user.email;
  if (!email) return apiError("No email on session", 400);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid feedback");

  const packet = await db.packet.findUnique({
    where: { slug: params.slug },
    select: { id: true, status: true },
  });
  if (!packet || packet.status !== "PUBLISHED") return apiError("Packet not available", 404);

  await db.feedback.upsert({
    where: { packetId_userEmail: { packetId: packet.id, userEmail: email } },
    create: {
      packetId: packet.id,
      userEmail: email,
      stars: parsed.data.stars,
      matched: parsed.data.matched,
      comment: parsed.data.comment || null,
    },
    update: {
      stars: parsed.data.stars,
      matched: parsed.data.matched,
      comment: parsed.data.comment || null,
    },
  });

  syncSoon();
  return json({ ok: true });
}
