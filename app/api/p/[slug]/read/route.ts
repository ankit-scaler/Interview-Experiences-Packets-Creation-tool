import { guardAuthed, json, apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { syncSoon } from "@/lib/sync";
import { isInternalEmail } from "@/lib/internal";

export const runtime = "nodejs";

/** Record that the signed-in learner opened this packet (1 count / day max). */
export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const guard = await guardAuthed();
  if (guard.error) return guard.error;
  const email = guard.user.email;
  if (!email) return apiError("No email on session", 400);
  // Scaler staff reviewing a packet must not show up as a learner read.
  if (isInternalEmail(email)) return json({ ok: true, counted: false });

  const packet = await db.packet.findUnique({
    where: { slug: params.slug },
    select: { id: true, status: true },
  });
  if (!packet || packet.status !== "PUBLISHED") return apiError("Packet not available", 404);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const read = await db.packetRead.upsert({
    where: { packetId_userEmail: { packetId: packet.id, userEmail: email } },
    create: { packetId: packet.id, userEmail: email, userId: guard.user.id, readDays: 0 },
    update: { lastReadAt: new Date() },
  });

  await db.packetReadDay
    .create({ data: { packetReadId: read.id, day: today } })
    .catch(() => null); // unique (packetReadId, day) — ignore if already counted today

  const readDays = await db.packetReadDay.count({ where: { packetReadId: read.id } });
  await db.packetRead.update({
    where: { id: read.id },
    data: { readDays, lastReadAt: new Date() },
  });

  syncSoon();
  return json({ ok: true });
}
