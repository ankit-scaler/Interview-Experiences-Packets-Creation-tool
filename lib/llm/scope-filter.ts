import { complete, parseJson } from "./client";
import { modelFor } from "./models";
import type { PacketContext } from "@/lib/generation/types";

/**
 * Scope-lock check for ambiguous sheet rows: keep only questions whose role is
 * the same or an adjacent-relevant level for the target, and whose content fits
 * the requested stack. Language-agnostic questions (DSA / design / HR) stay in.
 */
const SYSTEM = `You enforce interview-packet scope lock. For each candidate question you are given its source role and round.
Keep a question (keep=true) only if BOTH:
- the source role is the same as, or an adjacent-relevant seniority level for, the target role + experience band, AND
- the question fits the target tech stack, OR is language-agnostic (DSA, algorithms, system/LLD design, SQL, behavioural/HR).
Reject cross-stack framework/tooling questions and questions from a clearly different discipline or a distant seniority level.
Return strict JSON: {"keep":[boolean,...]} in input order.`;

export async function scopeFilter(
  items: { id: number; role: string; round: string; text: string }[],
  ctx: PacketContext,
  meta: { jobId?: string; packetId?: string },
): Promise<Set<number>> {
  const keep = new Set<number>();
  if (!items.length) return keep;

  const BATCH = 50;
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const prompt = `Target role: ${ctx.role}
Target experience: ${ctx.level}
Target stack: ${ctx.stack || "not specified (keep language-agnostic questions)"}
Company: ${ctx.company}

Candidates:
${slice
  .map((s) => `${s.id}. [role: ${s.role || "?"}] [${s.round}] ${s.text.slice(0, 200)}`)
  .join("\n")}

Return JSON only, ${slice.length} booleans.`;

    // eslint-disable-next-line no-await-in-loop
    const res = await complete({
      purpose: "SCOPE_FILTER",
      model: modelFor("SCOPE_FILTER"),
      cachedSystem: SYSTEM,
      prompt,
      maxTokens: 1500,
      jobId: meta.jobId,
      packetId: meta.packetId,
    });

    try {
      const parsed = parseJson<{ keep: boolean[] }>(res.text);
      slice.forEach((s, idx) => {
        if (parsed.keep?.[idx]) keep.add(s.id);
      });
    } catch {
      // On parse failure, keep the batch (fail open — admin can prune in the editor).
      slice.forEach((s) => keep.add(s.id));
    }
  }
  return keep;
}
