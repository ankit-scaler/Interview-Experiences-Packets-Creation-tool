import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";
import { activityPacket, logActivity } from "@/lib/activity";

export const runtime = "nodejs";

const Body = z.object({ name: z.string().min(1).max(120), duration: z.string().max(60).optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Round name required");

  const max = await db.round.aggregate({
    where: { packetId: params.id, isSpillover: false },
    _max: { order: true },
  });
  const round = await db.round.create({
    data: {
      packetId: params.id,
      name: parsed.data.name,
      duration: parsed.data.duration || null,
      order: (max._max.order ?? -1) + 1,
      sheetKey: `manual-${Date.now()}`,
    },
  });
  await logActivity({
    actorEmail: guard.user.email,
    action: "ROUND_ADDED",
    packet: await activityPacket(params.id),
    detail: round.name,
  });
  return json({ round });
}
