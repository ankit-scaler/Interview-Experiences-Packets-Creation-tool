import { complete, parseJson } from "./client";
import { modelFor } from "./models";
import type { PacketContext } from "@/lib/generation/types";

export interface SpilloverResult {
  jdSummary: string;
  missingTechs: { tech: string; questions: string[] }[];
}

const SYSTEM = `You analyse a job description against the topics already covered by an interview packet.
Task:
1. Write a 2-3 sentence internal summary of the JD (tech stack, seniority, focus areas).
2. Identify significant technologies/skills named in the JD that are NOT represented in the covered topics.
3. For each such tech (max 5), write ~10 interview questions that a candidate for THIS role would realistically be asked, at the right seniority. Specific, self-contained, no answers.
Return strict JSON: {"jdSummary":string,"missingTechs":[{"tech":string,"questions":[string,...]}]}`;

export async function jdSpillover(
  ctx: PacketContext,
  coveredTopics: string[],
  meta: { jobId?: string; packetId?: string },
): Promise<SpilloverResult> {
  if (!ctx.jdText.trim()) return { jdSummary: "", missingTechs: [] };

  const prompt = `Role: ${ctx.role}${ctx.stack ? ` (${ctx.stack})` : ""} at ${ctx.company}
Level: ${ctx.level}

Covered topics already in the packet:
${coveredTopics.slice(0, 120).join(", ") || "(none)"}

Job description:
"""
${ctx.jdText.slice(0, 6000)}
"""

Return JSON only.`;

  const res = await complete({
    purpose: "JD_SPILLOVER",
    model: modelFor("JD_SPILLOVER"),
    cachedSystem: SYSTEM,
    prompt,
    maxTokens: 6000,
    jobId: meta.jobId,
    packetId: meta.packetId,
  });

  try {
    const parsed = parseJson<SpilloverResult>(res.text);
    return {
      jdSummary: parsed.jdSummary?.trim() ?? "",
      missingTechs: (parsed.missingTechs ?? [])
        .filter((t) => t && t.tech && Array.isArray(t.questions))
        .slice(0, 5)
        .map((t) => ({
          tech: String(t.tech).trim(),
          questions: t.questions.map((q) => String(q).trim()).filter(Boolean).slice(0, 12),
        })),
    };
  } catch {
    return { jdSummary: "", missingTechs: [] };
  }
}
