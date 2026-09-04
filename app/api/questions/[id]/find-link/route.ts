import { guardAdmin, json, apiError } from "@/lib/api";
import { db } from "@/lib/db";
import { hasLlm } from "@/lib/env";
import { findProblemLinks } from "@/lib/llm/problem-links";
import { practiceDomains } from "@/lib/web-sources";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;
  if (!hasLlm()) return apiError("OPENROUTER_API_KEY is not configured.", 400);

  const q = await db.question.findUnique({
    where: { id: params.id },
    include: { packet: { select: { webSources: true } } },
  });
  if (!q) return apiError("Question not found", 404);

  // Manual lookup respects the packet's enabled sources, but works in any mode.
  const domains = practiceDomains(q.packet.webSources);
  if (!domains.length) {
    return apiError("No practice source (LeetCode / GfG) is enabled for this packet.", 400);
  }

  const [result] = await findProblemLinks([{ id: 0, text: q.displayText }], {
    packetId: q.packetId,
    domains,
  });
  if (!result?.url) return json({ url: null });

  await db.question.update({
    where: { id: q.id },
    data: { problemLink: result.url, problemLinkSource: result.source ?? "LEETCODE" },
  });
  return json({ url: result.url, source: result.source });
}
