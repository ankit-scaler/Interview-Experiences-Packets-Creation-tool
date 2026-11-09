import { z } from "zod";
import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";
import { activityPacket, logActivity } from "@/lib/activity";
import { startGenerationJob } from "@/lib/generation/create";
import { companyConfirmed, packetResetData } from "@/lib/sections";

export const runtime = "nodejs";

const Body = z.object({ confirmCompany: z.string(), clearAddOns: z.boolean().optional() });

/**
 * Wipe a packet's generated content (rounds, questions, suppressed list) and
 * regenerate from scratch. Keeps the packet, link, JD, reads and feedback.
 * Add-Ons survive unless `clearAddOns` is true.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("confirmCompany required");

  const packet = await db.packet.findUnique({
    where: { id: params.id },
    select: { id: true, company: true },
  });
  if (!packet) return apiError("Packet not found.", 404);

  // Confirmation first, so nothing below runs on a mistyped name.
  if (!companyConfirmed(parsed.data.confirmCompany, packet.company)) {
    return apiError("Company name doesn't match.", 400);
  }

  const stale = new Date(Date.now() - 10 * 60_000);
  const running = await db.generationJob.findFirst({
    where: { packetId: packet.id, status: { in: ["PENDING", "RUNNING"] }, startedAt: { gte: stale } },
    select: { id: true },
  });
  if (running) return apiError("A generation is running — wait for it to finish first.", 409);

  const clearAddOns = parsed.data.clearAddOns === true;
  const activity = await activityPacket(packet.id);

  await db.$transaction([
    db.question.deleteMany({ where: { packetId: packet.id } }),
    db.round.deleteMany({ where: { packetId: packet.id } }),
    db.suppressedQuestion.deleteMany({ where: { packetId: packet.id } }),
    db.packet.update({ where: { id: packet.id }, data: packetResetData(clearAddOns) }),
  ]);

  await logActivity({
    actorEmail: guard.user.email,
    action: "PACKET_RESET",
    packet: activity,
    detail: clearAddOns ? "Add-Ons cleared too" : "Add-Ons kept",
  });

  try {
    // Zero questions now, so this starts an INITIAL job.
    const job = await startGenerationJob(packet.id, guard.user.id);
    return json({ jobId: job.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError(`Packet was reset, but generation could not start: ${message}`, 500);
  }
}
