/**
 * The web sources an admin can enable for a packet. Pure data — shared by the
 * create form (client) and the research/link steps (server).
 */

export interface WebSource {
  id: string;
  label: string;
  domains: string[];
  /** Usable for finding a canonical practice-problem URL. */
  practice?: boolean;
  hint?: string;
}

export const WEB_SOURCES: WebSource[] = [
  { id: "leetcode", label: "LeetCode", domains: ["leetcode.com"], practice: true, hint: "Problems + company tags" },
  { id: "geeksforgeeks", label: "GeeksforGeeks", domains: ["geeksforgeeks.org"], practice: true, hint: "Interview experiences" },
  { id: "linkedin", label: "LinkedIn", domains: ["linkedin.com"], hint: "Interview posts" },
  { id: "medium", label: "Medium", domains: ["medium.com"], hint: "Write-ups" },
];

export const ALL_SOURCE_IDS = WEB_SOURCES.map((s) => s.id);

/** Sources ticked by default on the create form. LinkedIn is opt-in — its posts
 * are the noisiest of the four. */
export const DEFAULT_SOURCE_IDS = ["leetcode", "geeksforgeeks", "medium"];

/** Source ids that can yield a practice link (LeetCode / GfG). */
export const PRACTICE_SOURCE_IDS = WEB_SOURCES.filter((s) => s.practice).map((s) => s.id);

function byId(ids: string[]): WebSource[] {
  const set = new Set(ids);
  return WEB_SOURCES.filter((s) => set.has(s.id));
}

/** Domains to search for general research. Empty selection = every source. */
export function researchDomains(ids: string[] | null | undefined): string[] {
  const chosen = ids?.length ? byId(ids) : WEB_SOURCES;
  return chosen.flatMap((s) => s.domains);
}

/**
 * Domains to search when hunting for a practice link. Returns [] when the admin
 * turned off every practice source — the caller should then skip the step.
 */
export function practiceDomains(ids: string[] | null | undefined): string[] {
  const chosen = ids?.length ? byId(ids) : WEB_SOURCES;
  return chosen.filter((s) => s.practice).flatMap((s) => s.domains);
}

/** Human labels, for logs and the editor. */
export function sourceLabels(ids: string[] | null | undefined): string {
  const chosen = ids?.length ? byId(ids) : WEB_SOURCES;
  return chosen.map((s) => s.label).join(", ");
}
