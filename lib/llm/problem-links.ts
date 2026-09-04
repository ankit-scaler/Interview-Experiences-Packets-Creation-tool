import { complete, parseJson, type WebPlugin } from "./client";
import { modelFor } from "./models";
import { env } from "@/lib/env";

function webPlugin(domains: string[]): WebPlugin {
  return {
    id: "web",
    include_domains: domains,
    max_results: env.linkSearchMaxResults,
  };
}

const CODING_HINT =
  /\b(write (a|code|query)|implement|given (an? )?(array|string|tree|graph|linked list|matrix)|find the|design an algorithm|sql query|leetcode|time complexity|return the|maximum|minimum|subarray|palindrome|binary tree|two sum|dynamic programming)\b/i;

export function looksLikeCodingProblem(text: string): boolean {
  return CODING_HINT.test(text);
}

export interface LinkResult {
  id: number;
  url: string | null;
  source: "LEETCODE" | "GFG" | null;
}

/**
 * For coding/DSA questions with no link, find a canonical LeetCode/GFG URL.
 * Returns null for anything not confidently matched.
 */
export async function findProblemLinks(
  items: { id: number; text: string }[],
  meta: { jobId?: string; packetId?: string; domains: string[] },
): Promise<LinkResult[]> {
  // No practice source enabled for this packet — skip the (billed) search entirely.
  if (!meta.domains.length) return [];

  const targets = items
    .filter((it) => looksLikeCodingProblem(it.text))
    .slice(0, env.linkLookupMaxQuestions);
  if (!targets.length) return [];

  const sites = meta.domains.join(" or ");
  const prompt = `For each problem, find the single canonical practice URL on ${sites} that matches it. Only return a URL you are confident is the same problem; otherwise return null.
Return strict JSON: {"items":[{"id":number,"url":string|null,"source":"LEETCODE"|"GFG"|null}]}

${targets.map((t) => `${t.id}. ${t.text.slice(0, 240)}`).join("\n")}`;

  const res = await complete({
    purpose: "LINK_LOOKUP",
    model: modelFor("LINK_LOOKUP"),
    prompt,
    maxTokens: 1500,
    web: webPlugin(meta.domains),
    jobId: meta.jobId,
    packetId: meta.packetId,
  });

  try {
    const parsed = parseJson<{ items: LinkResult[] }>(res.text);
    return (parsed.items ?? []).filter(
      (it) => typeof it.id === "number" && (it.url === null || /^https?:\/\//.test(it.url)),
    );
  } catch {
    return [];
  }
}
