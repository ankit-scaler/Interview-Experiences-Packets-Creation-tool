import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const Patch = z.object({
  stack: z.string().max(120).nullable().optional(),
  sourceMode: z.enum(["SHEET_ONLY", "SHEET_PLUS_WEB"]).optional(),
  allowHigherCost: z.boolean().optional(),
  rounds: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(120),
        duration: z.string().max(60).nullable(),
        order: z.number().int().optional(),
      }),
    )
    .optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");
  const { rounds, ...packetFields } = parsed.data;

  if (Object.keys(packetFields).length) {
    await db.packet.update({ where: { id: params.id }, data: packetFields });
  }
  if (rounds?.length) {
    await db.$transaction(
      rounds.map((r) =>
        db.round.update({
          where: { id: r.id },
          data: { name: r.name, duration: r.duration, ...(r.order !== undefined ? { order: r.order } : {}) },
        }),
      ),
    );
  }
  return json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  await db.packet.delete({ where: { id: params.id } });
  return json({ ok: true });
}
