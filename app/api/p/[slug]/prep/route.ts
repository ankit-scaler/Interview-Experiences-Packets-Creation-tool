import { guardAuthed, json } from "@/lib/api";
import { db } from "@/lib/db";
import { isInternalEmail } from "@/lib/internal";
import { PREP_MAX_SECONDS, clampPct, clampPrepSeconds } from "@/lib/prep";

export const runtime = "nodejs";

/**
 * Record the signed-in learner reading the Preparatory Kit. The first call
 * creates the row (first read); every call bumps last read, raises the furthest
 * scroll depth (stamping when it was reached) and adds active seconds.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const guard = await guardAuthed();
  if (guard.error) return guard.error;
  const email = guard.user.email;
  if (!email) return json({ ok: false });
  // Scaler staff reviewing a packet must not show up as a learner read.
  if (isInternalEmail(email)) return json({ ok: true, counted: false });

  const body = (await req.json().catch(() => ({}))) as { seconds?: unknown; scrollPct?: unknown };
  const seconds = clampPrepSeconds(body.seconds);
  const pct = clampPct(body.scrollPct);

  const packet = await db.packet.findUnique({
    where: { slug: params.slug },
    select: { id: true, status: true, prepMaterial: true },
  });
  if (!packet || packet.status !== "PUBLISHED" || !packet.prepMaterial?.trim()) {
    return json({ ok: false });
  }

  const now = new Date();
  const row = await db.prepRead.upsert({
    where: { packetId_userEmail: { packetId: packet.id, userEmail: email } },
    create: { packetId: packet.id, userEmail: email, userId: guard.user.id },
    update: { lastReadAt: now },
    select: { id: true },
  });

  // Depth only ever climbs, and its timestamp moves only when it does.
  if (pct > 0) {
    await db.prepRead.updateMany({
      where: { id: row.id, maxScrollPct: { lt: pct } },
      data: { maxScrollPct: pct, maxScrollAt: now },
    });
  }
  if (seconds > 0) {
    await db.prepRead.updateMany({
      where: { id: row.id, secondsTotal: { lt: PREP_MAX_SECONDS } },
      data: { secondsTotal: { increment: seconds } },
    });
  }
  return json({ ok: true });
}
