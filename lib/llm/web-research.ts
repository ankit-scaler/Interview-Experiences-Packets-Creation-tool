import { complete, parseJson, type WebPlugin } from "./client";
import { modelFor } from "./models";
import { env } from "@/lib/env";
import { researchDomains } from "@/lib/web-sources";
import { PACKET_PROMPT_STATIC, buildPacketPrompt } from "./prompts/packet";
import type { PacketContext } from "@/lib/generation/types";

export interface WebResearchResult {
  grounded: boolean;
  note: string;
  rounds: { name: string; duration: string; questions: string[] }[];
}

/** OpenRouter web plugin, restricted to the packet's enabled sources. */
function webPlugin(domains: string[]): WebPlugin {
  return {
    id: "web",
    include_domains: domains,
    max_results: env.webSearchMaxResults,
  };
}

/**
 * Run the manual packet prompt against Claude with web search, restricted to the
 * approved sources. Returns round-wise questions (empty if not grounded).
 */
export async function webResearch(
  ctx: PacketContext,
  meta: { jobId?: string; packetId?: string },
): Promise<WebResearchResult> {
  const res = await complete({
    purpose: "WEB_RESEARCH",
    model: modelFor("WEB_RESEARCH"),
    cachedSystem: PACKET_PROMPT_STATIC,
    prompt: buildPacketPrompt({
      company: ctx.company,
      role: ctx.role,
      stack: ctx.stack,
      level: ctx.level,
      location: ctx.location,
      timeframe: "last 24 months",
    }),
    maxTokens: 8000,
    web: webPlugin(researchDomains(ctx.webSources)),
    jobId: meta.jobId,
    packetId: meta.packetId,
  });

  try {
    const parsed = parseJson<WebResearchResult>(res.text);
    return {
      grounded: Boolean(parsed.grounded),
      note: parsed.note ?? "",
      rounds: Array.isArray(parsed.rounds)
        ? parsed.rounds
            .filter((r) => r && Array.isArray(r.questions))
            .map((r) => ({
              name: String(r.name ?? "Round"),
              duration: String(r.duration ?? ""),
              questions: r.questions.map((q) => String(q).trim()).filter(Boolean),
            }))
        : [],
    };
  } catch {
    return { grounded: false, note: "Web research returned no parseable result.", rounds: [] };
  }
}
