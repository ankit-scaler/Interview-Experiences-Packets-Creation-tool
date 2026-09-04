import { guardAuthed, json } from "@/lib/api";
import { db } from "@/lib/db";
import { isInternalEmail } from "@/lib/internal";

export const runtime = "nodejs";

const MAX_DELTA = 180; // ignore idle catch-up spikes
const MAX_DAY_SECONDS = 3 * 3600;

/** Accumulate a learner's active time on this packet for today, plus scroll depth. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const guard = await guardAuthed();
  if (guard.error) return guard.error;
  const email = guard.user.email;
  if (!email) return json({ ok: false });
  if (isInternalEmail(email)) return json({ ok: true, counted: false });

  const body = (await req.json().catch(() => ({}))) as { seconds?: number; scrollPct?: number };
  const delta = Math.min(MAX_DELTA, Math.max(0, Math.round(body.seconds ?? 0)));
  const scrollPct = Math.min(100, Math.max(0, Math.round(body.scrollPct ?? 0)));
  if (!delta && !scrollPct) return json({ ok: true });

  const packet = await db.packet.findUnique({
    where: { slug: params.slug },
    select: { id: true, status: true },
  });
  if (!packet || packet.status !== "PUBLISHED") return json({ ok: false });

  const read = await db.packetRead.findUnique({
    where: { packetId_userEmail: { packetId: packet.id, userEmail: email } },
    select: { id: true, scrollPct: true },
  });
  if (!read) return json({ ok: false });

  // Scroll depth only ever climbs — a learner scrolling back up hasn't unread it.
  if (scrollPct > read.scrollPct) {
    await db.packetRead.update({ where: { id: read.id }, data: { scrollPct } });
  }

  if (delta) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const day = await db.packetReadDay.upsert({
      where: { packetReadId_day: { packetReadId: read.id, day: today } },
      create: { packetReadId: read.id, day: today, seconds: 0 },
      update: {},
    });
    if (day.seconds < MAX_DAY_SECONDS) {
      await db.packetReadDay.update({
        where: { id: day.id },
        data: { seconds: Math.min(MAX_DAY_SECONDS, day.seconds + delta) },
      });
    }
  }
  return json({ ok: true });
}
