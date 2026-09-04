/**
 * Pure text-normalisation + fuzzy-similarity helpers.
 * Used for company/role matching and question de-duplication so the LLM is only
 * consulted for genuinely ambiguous cases (cost rule in the build plan).
 */

const COMPANY_SUFFIXES = [
  "inc",
  "incorporated",
  "llc",
  "llp",
  "ltd",
  "limited",
  "pvt",
  "private",
  "corp",
  "corporation",
  "co",
  "company",
  "technologies",
  "technology",
  "technologprovid",
  "tech",
  "labs",
  "lab",
  "solutions",
  "solution",
  "software",
  "systems",
  "services",
  "consulting",
  "global",
  "india",
  "pvtltd",
];

/** Lowercase, strip punctuation, collapse whitespace. */
export function basicNormalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Company name → canonical comparison key (suffixes removed). */
export function normalizeCompany(s: string): string {
  const words = basicNormalize(s).split(" ").filter(Boolean);
  const kept = words.filter((w) => !COMPANY_SUFFIXES.includes(w));
  return (kept.length ? kept : words).join(" ");
}

/** Role/title → canonical comparison key. */
export function normalizeRole(s: string): string {
  return basicNormalize(s)
    .replace(/\b(sr|snr)\b/g, "senior")
    .replace(/\b(jr)\b/g, "junior")
    .replace(/\bengineer(ing)?\b/g, "engineer")
    .replace(/\bdeveloper\b/g, "developer")
    .replace(/\bsde\b/g, "sde")
    .replace(/\s+/g, " ")
    .trim();
}

/** Question text → dedupe key: drop "problem link" tails, punctuation, stopwords-ish noise. */
export function normalizeQuestion(s: string): string {
  return basicNormalize(
    s
      .replace(/problem link\s*:[\s\S]*$/i, "")
      .replace(/&#13;?/g, " ")
      .replace(/\bfollow[\s-]?ups?\b/gi, " "),
  )
    .split(" ")
    .filter((w) => w.length > 1)
    .join(" ");
}

/** Character trigram set. */
export function trigrams(s: string): Set<string> {
  const t = `  ${s}  `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

/** Jaccard similarity of trigram sets, 0..1. */
export function trigramSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let inter = 0;
  ta.forEach((g) => {
    if (tb.has(g)) inter++;
  });
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Token (word) Jaccard similarity, 0..1 — better for reordered phrasing. */
export function tokenSimilarity(a: string, b: string): number {
  const sa = new Set(a.split(" ").filter(Boolean));
  const sb = new Set(b.split(" ").filter(Boolean));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  sa.forEach((w) => {
    if (sb.has(w)) inter++;
  });
  const denom = sa.size + sb.size - inter;
  return denom === 0 ? 0 : inter / denom;
}

/** Combined similarity used for question de-duplication. */
export function questionSimilarity(a: string, b: string): number {
  return Math.max(trigramSimilarity(a, b), tokenSimilarity(a, b) * 0.95);
}
