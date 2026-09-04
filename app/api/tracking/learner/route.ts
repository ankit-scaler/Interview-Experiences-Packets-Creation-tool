import { guardAdmin, json, apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { isInternalEmail } from "@/lib/internal";

export const runtime = "nodejs";

/** All packets a given learner email has opened. */
export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return apiError("email query param required");

  const reads = await db.packetRead.findMany({
    where: { userEmail: { equals: email, mode: "insensitive" } },
    include: { packet: { select: { slug: true, company: true, role: true, track: true } } },
    orderBy: { lastReadAt: "desc" },
  });
  const feedback = await db.feedback.findMany({
    where: { userEmail: { equals: email, mode: "insensitive" } },
    include: { packet: { select: { slug: true, company: true, role: true } } },
  });

  return json({
    email,
    // Scaler staff activity is excluded from every metric; surface that here so
    // an admin doesn't mistake a review session for a learner.
    internal: isInternalEmail(email),
    reads: reads.map((r) => ({
      slug: r.packet.slug,
      company: r.packet.company,
      role: r.packet.role,
      track: r.packet.track,
      firstReadAt: r.firstReadAt,
      lastReadAt: r.lastReadAt,
      readDays: r.readDays,
    })),
    feedback: feedback.map((f) => ({
      slug: f.packet.slug,
      company: f.packet.company,
      role: f.packet.role,
      stars: f.stars,
      matched: f.matched,
      comment: f.comment,
    })),
  });
}
