/** Pure helpers for packet sections (Add-Ons, round order, reset). No I/O. */

export const ADDONS_MAX = 20_000;

/** Empty / whitespace-only Add-Ons mean "not added" (stored as null). */
export function normalizeAddOns(input: string | null | undefined): string | null {
  const t = (input ?? "").trim();
  return t ? t : null;
}

/** Show "Read more" only when the text would overflow a ~3-line preview. */
export function addOnsNeedsToggle(md: string): boolean {
  const lines = md.split("\n").filter((l) => l.trim()).length;
  return md.length > 180 || lines > 3;
}

/** Swap `id` with its neighbour. No-op at the ends or if the id is unknown. */
export function moveId(ids: string[], id: string, dir: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** True when `b` is exactly a permutation of `a` (no dups, missing or extra). */
export function isSameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  if (set.size !== a.length) return false;
  const seen = new Set<string>();
  for (const id of b) {
    if (!set.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

/** Reset confirmation: exact company name, trimmed, case-sensitive. */
export function companyConfirmed(typed: string, company: string): boolean {
  const t = typed.trim();
  return t.length > 0 && t === company.trim();
}

/** Packet columns written by Reset. `addOns` is only included when clearing it. */
export function packetResetData(clearAddOns: boolean) {
  return {
    jdSummary: null,
    lastSheetRowDate: null,
    lastGeneratedAt: null,
    status: "DRAFT" as const,
    ...(clearAddOns ? { addOns: null } : {}),
  } as {
    jdSummary: null;
    lastSheetRowDate: null;
    lastGeneratedAt: null;
    status: "DRAFT";
    addOns?: null;
  };
}
