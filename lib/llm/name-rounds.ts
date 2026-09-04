import { complete, parseJson } from "./client";
import { modelFor } from "./models";
import type { PacketContext, DraftRound } from "@/lib/generation/types";

const SYSTEM = `You label interview rounds. Given a company, role, and the questions asked in each round, infer:
- a realistic round name (e.g. "Online Assessment", "DSA Round", "Machine Coding", "System Design", "Hiring Manager", "Culture Fit / HR")
- a typical duration string (e.g. "45 minutes", "1 hour"); use "" if genuinely unknown
Do not invent rounds. Keep the given order. Return strict JSON: {"rounds":[{"key":string,"name":string,"duration":string}]}`;

/**
 * Fill in human round names + durations for rounds that only have a sheet code
 * (e.g. "R1"). Rounds already carrying a descriptive name are left alone.
 */
export async function nameRounds(
  rounds: DraftRound[],
  ctx: PacketContext,
  meta: { jobId?: string; packetId?: string },
): Promise<Map<string, { name: string; duration: string | null }>> {
  const out = new Map<string, { name: string; duration: string | null }>();
  const needing = rounds.filter(
    (r) => !r.isSpillover && (/^r\d+$/i.test(r.name.trim()) || r.name.trim().length < 4),
  );
  if (!needing.length) return out;

  const prompt = `Company: ${ctx.company}
Role: ${ctx.role}${ctx.stack ? ` (${ctx.stack})` : ""}
Level: ${ctx.level}

Rounds and a sample of their questions:
${needing
  .map(
    (r) =>
      `[${r.key}]\n${r.questions
        .slice(0, 8)
        .map((q) => `- ${q.text.slice(0, 160)}`)
        .join("\n")}`,
  )
  .join("\n\n")}

Return JSON only.`;

  const res = await complete({
    purpose: "NAME_ROUNDS",
    model: modelFor("NAME_ROUNDS"),
    cachedSystem: SYSTEM,
    prompt,
    maxTokens: 1200,
    jobId: meta.jobId,
    packetId: meta.packetId,
  });

  try {
    const parsed = parseJson<{ rounds: { key: string; name: string; duration: string }[] }>(
      res.text,
    );
    for (const r of parsed.rounds ?? []) {
      if (r.key && r.name) out.set(r.key, { name: r.name.trim(), duration: r.duration?.trim() || null });
    }
  } catch {
    // Fall back to "Round N" in the caller.
  }
  return out;
}
