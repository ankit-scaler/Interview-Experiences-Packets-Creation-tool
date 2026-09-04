import { complete, parseJson } from "./client";
import { modelFor } from "./models";
import type { PacketContext } from "@/lib/generation/types";

/** Heuristic: text that is already clean enough to skip the readability pass. */
export function looksClean(text: string): boolean {
  const t = text.trim();
  if (t.length < 12 || t.length > 600) return false;
  if (/&#\d+;|�|\bpls\b|\bu r\b/i.test(t)) return false;
  if (!/[.?]$/.test(t) && t.split(/\s+/).length > 6) return false;
  const capsRatio = (t.replace(/[^A-Z]/g, "").length) / t.length;
  if (capsRatio > 0.4) return false;
  return true;
}

const SYSTEM = `You lightly copy-edit interview questions for readability. Rules:
- Fix grammar, spelling, punctuation, and obvious transcription errors only.
- Do NOT change the technical ask, add detail, or remove constraints.
- Keep it a single self-contained question. No preamble, no answer.
- If the input is already fine, return it unchanged.
Return strict JSON: {"items":[{"id":number,"text":string}]}`;

/**
 * Batch-improve question readability. Returns a map id → improved text.
 * Items judged already-clean are skipped (not sent to the model).
 */
export async function improveReadability(
  items: { id: number; text: string }[],
  ctx: PacketContext,
  meta: { jobId?: string; packetId?: string },
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const dirty = items.filter((it) => !looksClean(it.text));
  if (!dirty.length) return out;

  const BATCH = 40;
  for (let i = 0; i < dirty.length; i += BATCH) {
    const slice = dirty.slice(i, i + BATCH);
    const prompt = `Context: ${ctx.company} — ${ctx.role}${ctx.stack ? ` (${ctx.stack})` : ""}.
Copy-edit each question. Return JSON only.

${slice.map((s) => `${s.id}. ${s.text.replace(/\s+/g, " ").trim()}`).join("\n")}`;

    // eslint-disable-next-line no-await-in-loop
    const res = await complete({
      purpose: "READABILITY",
      model: modelFor("READABILITY"),
      cachedSystem: SYSTEM,
      prompt,
      maxTokens: 4000,
      jobId: meta.jobId,
      packetId: meta.packetId,
    });

    try {
      const parsed = parseJson<{ items: { id: number; text: string }[] }>(res.text);
      for (const it of parsed.items ?? []) {
        if (typeof it.id === "number" && typeof it.text === "string" && it.text.trim()) {
          out.set(it.id, it.text.trim());
        }
      }
    } catch {
      // Leave this batch unimproved rather than fail the whole run.
    }
  }
  return out;
}
