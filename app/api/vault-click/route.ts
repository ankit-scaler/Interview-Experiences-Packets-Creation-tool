import { guardAuthed, json } from "@/lib/api";
import { db } from "@/lib/db";
import { syncSoon } from "@/lib/sync";
import { isInternalEmail } from "@/lib/internal";

export const runtime = "nodejs";

/** Log that a learner clicked through to the Interview Experiences vault. */
export async function POST(req: Request) {
  const guard = await guardAuthed();
  if (guard.error) return guard.error;
  const email = guard.user.email;
  if (!email) return json({ ok: false });
  if (isInternalEmail(email)) return json({ ok: true, counted: false });

  const body = (await req.json().catch(() => ({}))) as { slug?: string };
  let packetId: string | undefined;
  if (body.slug) {
    const p = await db.packet.findUnique({ where: { slug: body.slug }, select: { id: true } });
    packetId = p?.id;
  }

  await db.vaultClick.create({ data: { userEmail: email, packetId } });
  syncSoon();
  return json({ ok: true });
}
