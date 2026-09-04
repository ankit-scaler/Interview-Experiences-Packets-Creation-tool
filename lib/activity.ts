/**
 * Admin activity log — who changed what, and when.
 *
 * Written from the admin mutation routes only. Logging must never break the
 * mutation it describes, so every write is best-effort and swallows its errors.
 */
import type { AdminAction } from "@prisma/client";
import { db } from "@/lib/db";

/** Denormalised packet identity, captured so the entry survives a delete. */
export interface ActivityPacket {
  id: string;
  company: string;
  role: string;
  slug: string | null;
}

export async function logActivity(opts: {
  actorEmail: string | null | undefined;
  action: AdminAction;
  packet: ActivityPacket | null;
  detail?: string | null;
}): Promise<void> {
  if (!opts.actorEmail) return;
  try {
    await db.adminActivity.create({
      data: {
        actorEmail: opts.actorEmail,
        action: opts.action,
        packetId: opts.packet?.id ?? null,
        packetLabel: opts.packet ? `${opts.packet.company} — ${opts.packet.role}` : "—",
        packetSlug: opts.packet?.slug ?? null,
        detail: opts.detail ?? null,
      },
    });
  } catch {
    /* the mutation already succeeded — never fail it over an audit row */
  }
}

/** Look up the packet identity for a log entry, by packet id. */
export async function activityPacket(packetId: string): Promise<ActivityPacket | null> {
  return db.packet.findUnique({
    where: { id: packetId },
    select: { id: true, company: true, role: true, slug: true },
  });
}

/** Same, reached via a round. */
export async function activityPacketByRound(roundId: string): Promise<ActivityPacket | null> {
  const round = await db.round.findUnique({
    where: { id: roundId },
    select: { packet: { select: { id: true, company: true, role: true, slug: true } } },
  });
  return round?.packet ?? null;
}

/** Same, reached via a question. */
export async function activityPacketByQuestion(questionId: string): Promise<ActivityPacket | null> {
  const q = await db.question.findUnique({
    where: { id: questionId },
    select: { packet: { select: { id: true, company: true, role: true, slug: true } } },
  });
  return q?.packet ?? null;
}

/** Keep a question/round snippet short enough to read in a log row. */
export function truncate(s: string, max = 80): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

