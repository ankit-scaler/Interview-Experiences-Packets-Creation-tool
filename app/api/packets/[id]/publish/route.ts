import { apiError, guardAdmin, json } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const body = (await req.json().catch(() => ({}))) as { publish?: boolean };
  const publish = body.publish ?? true;

  if (publish) {
    const count = await db.question.count({
      where: { packetId: params.id, status: "ACTIVE" },
    });
    if (count === 0) return apiError("Add at least one question before publishing.");
  }

  const packet = await db.packet.update({
    where: { id: params.id },
    data: {
      status: publish ? "PUBLISHED" : "DRAFT",
      publishedAt: publish ? new Date() : null,
    },
  });
  return json({ ok: true, status: packet.status });
}
