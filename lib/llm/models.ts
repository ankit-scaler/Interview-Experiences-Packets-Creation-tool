import { env } from "@/lib/env";
import type { LlmPurpose } from "@prisma/client";

/** Which model each LLM purpose uses. Cheap (Haiku) by default; Sonnet for research. */
export function modelFor(purpose: LlmPurpose): string {
  switch (purpose) {
    case "WEB_RESEARCH":
    case "JD_SPILLOVER":
      return env.llmModel;
    default:
      return env.llmModelCheap;
  }
}

// The approved-source registry lives in lib/web-sources.ts so the create form can
// share it. Which of those are actually searched is chosen per packet.
export { WEB_SOURCES, researchDomains, practiceDomains } from "@/lib/web-sources";
