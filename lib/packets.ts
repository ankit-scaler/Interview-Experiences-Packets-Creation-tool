import { db } from "@/lib/db";

export async function listPackets() {
  const packets = await db.packet.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { questions: true, reads: true } },
      rounds: { select: { id: true } },
    },
  });
  return packets.map((p) => ({
    id: p.id,
    slug: p.slug,
    company: p.company,
    role: p.role,
    track: p.track,
    yoeBucket: p.yoeBucket,
    stack: p.stack,
    status: p.status,
    sourceMode: p.sourceMode,
    questionCount: p._count.questions,
    readCount: p._count.reads,
    roundCount: p.rounds.length,
    costUsd: p.lifetimeCostUsd,
    updatedAt: p.updatedAt,
    lastGeneratedAt: p.lastGeneratedAt,
  }));
}

export type PacketListItem = Awaited<ReturnType<typeof listPackets>>[number];

export async function getPacketForEditor(id: string) {
  return db.packet.findUnique({
    where: { id },
    include: {
      rounds: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            where: { status: "ACTIVE" },
            orderBy: { order: "asc" },
          },
        },
      },
      llmCalls: true,
      jobs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
}

export async function getPublishedPacket(slug: string) {
  return db.packet.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      rounds: {
        orderBy: [{ isSpillover: "asc" }, { order: "asc" }],
        include: {
          questions: {
            where: { status: "ACTIVE" },
            orderBy: { order: "asc" },
            select: { id: true, displayText: true, problemLink: true },
          },
        },
      },
    },
  });
}
