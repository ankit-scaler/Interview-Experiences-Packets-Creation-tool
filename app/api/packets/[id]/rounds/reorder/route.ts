import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";
import { activityPacket, logActivity } from "@/lib/activity";
import { isSameIdSet } from "@/lib/sections";

export const runtime = "nodejs";

const Body = z.object({ orderedIds: z.array(z.string()).min(1).max(200) });

/** Renumber the packet's non-JD rounds to match `orderedIds`. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("orderedIds required");

  const current = await db.round.findMany({
    where: { packetId: params.id, isSpillover: false },
    select: { id: true },
  });
  if (!isSameIdSet(current.map((r) => r.id), parsed.data.orderedIds)) {
    return apiError("Round list is out of date — refresh and try again.", 400);
  }

  await db.$transaction(
    parsed.data.orderedIds.map((id, i) => db.round.update({ where: { id }, data: { order: i } })),
  );
  await logActivity({
    actorEmail: guard.user.email,
    action: "ROUND_EDITED",
    packet: await activityPacket(params.id),
    detail: "Reordered rounds",
  });
  return json({ ok: true });
}
