/** Pure helpers for the Preparatory Kit. No I/O. */

/** HackMD notes run longer than Add-Ons (20k), so allow more. */
export const PREP_MAX = 60_000;
/** Per-request cap on reported active seconds (same idea as the heartbeat route). */
export const PREP_MAX_DELTA = 180;
/** Stop accumulating time past this total per learner × packet. */
export const PREP_MAX_SECONDS = 36_000;

/** What the reader is showing: the kit, or the round at this 0-based index. */
export type ReaderView = "prep" | number;

/** Empty / whitespace-only kit means "not added" (stored as null). */
export function normalizePrep(input: string | null | undefined): string | null {
  const t = (input ?? "").trim();
  return t ? t : null;
}

/**
 * `#prep` → kit, `#rN` → round N-1. Anything invalid (or `#prep` with no kit,
 * or an out-of-range round) falls back to the default: the kit when there is
 * one, otherwise round 1.
 */
export function parseReaderHash(hash: string, roundCount: number, hasPrep: boolean): ReaderView {
  const fallback: ReaderView = hasPrep ? "prep" : 0;
  if (hash === "#prep") return fallback;
  const m = hash.match(/^#r(\d+)$/);
  if (!m) return fallback;
  const n = Number(m[1]) - 1;
  return n >= 0 && n < roundCount ? n : fallback;
}

export function hashFor(view: ReaderView): string {
  return view === "prep" ? "#prep" : `#r${view + 1}`;
}

/**
 * How much of an element has been scrolled into view, 0–100: the part of it
 * above the viewport bottom ÷ its height. `top` is `getBoundingClientRect().top`.
 */
export function scrollSeenPct(top: number, height: number, viewportHeight: number): number {
  if (![top, height, viewportHeight].every(Number.isFinite)) return 0;
  if (height <= 0 || viewportHeight <= 0) return 0;
  const seen = Math.min(height, Math.max(0, viewportHeight - top));
  return Math.min(100, Math.max(0, Math.round((seen / height) * 100)));
}

export function clampPct(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function clampPrepSeconds(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(PREP_MAX_DELTA, Math.max(0, Math.round(raw)));
}
