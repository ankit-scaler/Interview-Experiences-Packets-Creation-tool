import { complete, parseJson } from "./client";
import { modelFor } from "./models";

/**
 * LLM tie-break for question pairs in the "maybe duplicate" similarity band.
 * Returns the set of indices (into `pairs`) that ARE the same question.
 */
export async function sameQuestionBatch(
  pairs: { a: string; b: string }[],
  meta: { jobId?: string; packetId?: string },
): Promise<boolean[]> {
  if (!pairs.length) return [];
  const prompt = `For each pair, answer whether A and B are essentially the SAME interview question (same core ask), ignoring wording, examples, and follow-ups.
Return strict JSON: {"same":[boolean,...]} in the same order.

${pairs
  .map((p, i) => `${i + 1}.\nA: ${p.a.slice(0, 300)}\nB: ${p.b.slice(0, 300)}`)
  .join("\n\n")}`;

  const res = await complete({
    purpose: "MERGE",
    model: modelFor("MERGE"),
    prompt,
    maxTokens: 500,
    jobId: meta.jobId,
    packetId: meta.packetId,
  });

  try {
    const parsed = parseJson<{ same: boolean[] }>(res.text);
    return pairs.map((_, i) => Boolean(parsed.same?.[i]));
  } catch {
    return pairs.map(() => false);
  }
}
