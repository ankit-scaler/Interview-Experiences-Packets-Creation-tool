import { roundKey, roundKeyOrder } from "@/lib/match";

/**
 * Round identity rules (deterministic — no LLM):
 *  - "Online Assessment", "Hiring Manager" and "HR" are single-instance kinds:
 *    a packet has at most one of each, however the source spelled them.
 *  - Technical (and every other) round may repeat; matched by exact key only.
 *  - The Online Assessment round is always first.
 */
export type RoundKind = "oa" | "hiring-manager" | "hr" | "other";

export interface RoundRef {
  id: string;
  name: string;
  order: number;
  sheetKey: string | null;
  isSpillover: boolean;
}

interface DraftLike {
  key: string;
  name: string;
  isSpillover?: boolean;
}

const OA = /\bonline[\s\-_]*(?:assessment|test)\b|\bo\.?a\b|\bcoding assessment\b/;
const HM = /\bhiring[\s\-_]*man\w*|\bhm\b/;
const HR = /\bhr\b|\bbehaviou?ral\b|\bculture[\s\-_]*fit\b/;

function clean(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function roundKind(name: string): RoundKind {
  const s = clean(name).toLowerCase();
  if (OA.test(s)) return "oa";
  if (HM.test(s)) return "hiring-manager";
  if (HR.test(s)) return "hr";
  return "other";
}

/** Letters left once kind words, "round", numbers and punctuation are removed. */
function residual(name: string, kindWords: RegExp): string {
  return clean(name)
    .toLowerCase()
    .replace(kindWords, " ")
    .replace(/\bround\b|\br\d+\b|\d+/g, " ")
    .replace(/[^\p{L}]+/gu, "");
}

/** Standard stored name: one spelling per kind, extra detail kept for combined rounds. */
export function canonicalRoundName(name: string): string {
  const n = clean(name);
  switch (roundKind(n)) {
    case "oa":
      return "Online Assessment";
    case "hiring-manager":
      if (!residual(n, /hiring[\s\-_]*man\w*|\bhm\b/g)) return "Hiring Manager";
      return n.replace(/(?:hiring[\s\-_]*man\w*|\bhm\b)(?:\s+round)?/gi, "Hiring Manager");
    case "hr":
      return residual(n, /\bhr\b|\bbehaviou?ral\b|\bculture[\s\-_]*fit\b/g) ? n : "HR / Behavioural";
    default:
      return n;
  }
}

/** Key used to combine sheet + web drafts: one per special kind, else the round key. */
export function kindKey(r: { key: string; name: string }): string {
  const k = roundKind(r.name);
  return k === "other" ? r.key : `kind:${k}`;
}

function existingKey(r: RoundRef): string {
  return r.sheetKey ?? roundKey(r.name);
}

/** The existing round a draft belongs to, if any. Never matches across the spillover boundary. */
export function findExistingRound<T extends RoundRef>(draft: DraftLike, existing: T[]): T | undefined {
  const pool = existing
    .filter((r) => r.isSpillover === Boolean(draft.isSpillover))
    .sort((a, b) => a.order - b.order);
  if (draft.isSpillover) return pool[0];
  const kind = roundKind(draft.name);
  if (kind !== "other") {
    const byKind = pool.find((r) => roundKind(r.name) === kind);
    if (byKind) return byKind;
  }
  return pool.find((r) => existingKey(r) === draft.key);
}

/** Sort rank for a draft round: OA first, HR / Hiring Manager late, else by round number. */
export function draftRank(d: { key: string; name: string }): number {
  return rankOfDraft(d);
}

function rankOfDraft(d: DraftLike): number {
  const kind = roundKind(d.name);
  if (kind === "oa") return -1;
  if (kind === "hr" || kind === "hiring-manager") return 90;
  return roundKeyOrder(d.key);
}

function rankOfExisting(r: RoundRef): number {
  if (roundKind(r.name) === "oa") return -1;
  return roundKeyOrder(existingKey(r));
}

/**
 * Where a NEW round goes. Existing rounds keep their (possibly hand-edited)
 * order; the new one is inserted before the first existing round that ranks
 * after it (OA ranks first), and later rounds shift down by one.
 */
export function planOrder(
  existing: RoundRef[],
  draft: DraftLike,
): { order: number; shifts: { id: string; order: number }[] } {
  if (draft.isSpillover) return { order: 900, shifts: [] };
  const rounds = existing.filter((r) => !r.isSpillover).sort((a, b) => a.order - b.order);
  const rank = rankOfDraft(draft);
  const idx = rounds.findIndex((r) => rankOfExisting(r) > rank);
  if (idx === -1) {
    return { order: rounds.length ? rounds[rounds.length - 1].order + 1 : 0, shifts: [] };
  }
  return {
    order: rounds[idx].order,
    shifts: rounds.slice(idx).map((r) => ({ id: r.id, order: r.order + 1 })),
  };
}
