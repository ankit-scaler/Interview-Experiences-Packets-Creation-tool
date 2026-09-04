/**
 * Company / role / year-of-experience matching between a packet request and
 * rows from the question-repo sheet. "Not strict, but relevant" (build plan).
 */

import type { YoeBucket } from "@prisma/client";
import { normalizeCompany, normalizeRole, trigramSimilarity } from "./normalize";

export const YOE_BUCKET_LABELS: Record<YoeBucket, string> = {
  LT2: "Less than 2 years",
  B2_5: "2 – 5 years",
  GT5: "5+ years",
};

/** Level keywords considered relevant for each YoE bucket (build-plan mapping). */
const YOE_LEVELS: Record<YoeBucket, string[]> = {
  LT2: ["intern", "trainee", "associate", "junior", "1", "2", "i", "ii", "sde 1", "sde 2", "engineer", "analyst"],
  B2_5: ["2", "3", "ii", "iii", "sde 2", "sde 3", "senior", "engineer", "developer", "specialist", "lead"],
  GT5: ["senior", "staff", "principal", "lead", "architect", "manager", "3", "4", "iv", "sde 3", "sde 4"],
};

export function yoeLevelKeywords(bucket: YoeBucket): string[] {
  return YOE_LEVELS[bucket];
}

/** True when a sheet company value plausibly refers to the requested company. */
export function companyMatches(target: string, candidate: string): boolean {
  const a = normalizeCompany(target);
  const b = normalizeCompany(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  return trigramSimilarity(a, b) >= 0.82;
}

/**
 * Deterministic role-level relevance. Returns:
 *  - "match"      → clearly the same/adjacent level, keep without asking the LLM
 *  - "ambiguous"  → send to the LLM scope filter
 *  - "reject"     → clearly a different level / discipline
 */
export function roleRelevance(
  targetRole: string,
  candidateRole: string,
  bucket: YoeBucket,
): "match" | "ambiguous" | "reject" {
  const a = normalizeRole(targetRole);
  const b = normalizeRole(candidateRole);
  if (!b) return "ambiguous";

  const sim = trigramSimilarity(a, b);
  const aNums: string[] = a.match(/\b([1-5]|i{1,3}|iv)\b/g) ?? [];
  const bNums: string[] = b.match(/\b([1-5]|i{1,3}|iv)\b/g) ?? [];

  // Same base title (Java Developer == Java Developer) and no conflicting level number.
  if (sim >= 0.72) {
    if (aNums.length && bNums.length && !aNums.some((n) => bNums.includes(n))) {
      return "ambiguous"; // e.g. SDE-1 vs SDE-2 — let YoE / LLM decide
    }
    return "match";
  }

  // Different wording but a level keyword for this YoE bucket appears.
  const levels = YOE_LEVELS[bucket];
  if (levels.some((lvl) => b.includes(lvl))) return "ambiguous";

  if (sim >= 0.4) return "ambiguous";
  return "reject";
}

/** Normalise a sheet round label to a stable key, e.g. "R1 - Technical" → "r1". */
export function roundKey(raw: string): string {
  const s = raw.toLowerCase().trim();
  const m = s.match(/r(?:ound)?\s*[-\s]?\s*(\d+)/);
  if (m) return `r${m[1]}`;
  if (/screen|hr|managerial|behav|culture|hiring manager/.test(s)) return "hr";
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "r1";
}

/** Human ordering for round keys. */
export function roundKeyOrder(key: string): number {
  const m = key.match(/^r(\d+)$/);
  if (m) return Number(m[1]);
  if (key === "hr") return 90;
  return 50;
}
