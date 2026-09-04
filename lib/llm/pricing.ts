/**
 * Cost accounting.
 *
 * OpenRouter returns the *actual billed* cost on every response (`usage.cost`),
 * which already includes web-search fees — so that is authoritative when present.
 * The table below is only a fallback estimate for when it isn't.
 *
 * Rates are USD per 1M tokens. Cache reads ≈ 0.1×, cache writes ≈ 1.25× input.
 */
type Price = { input: number; output: number };

const TABLE: Record<string, Price> = {
  "anthropic/claude-opus-5": { input: 5, output: 25 },
  "anthropic/claude-opus-4.8": { input: 5, output: 25 },
  "anthropic/claude-sonnet-5": { input: 2, output: 10 },
  "anthropic/claude-sonnet-4.6": { input: 3, output: 15 },
  "anthropic/claude-haiku-4.5": { input: 1, output: 5 },
  "openai/gpt-5.2": { input: 1.25, output: 10 },
};

function priceFor(model: string): Price {
  if (TABLE[model]) return TABLE[model];
  const key = Object.keys(TABLE).find((k) => model.startsWith(k));
  return key ? TABLE[key] : { input: 3, output: 15 };
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens?: number;
  /** Actual cost reported by OpenRouter — preferred over the estimate below. */
  reportedCostUsd?: number;
  /** Only used by the fallback estimate (OpenRouter folds this into `cost`). */
  webSearchRequests?: number;
}

/** Per-search fee used only when estimating (OpenRouter/Exa ≈ $0.007). */
export const WEB_SEARCH_USD_PER_1K = 7;

export function costUsd(model: string, u: TokenUsage): number {
  // Trust OpenRouter's billed figure when we have it.
  if (typeof u.reportedCostUsd === "number" && u.reportedCostUsd >= 0) {
    return Math.round(u.reportedCostUsd * 1e6) / 1e6;
  }

  const p = priceFor(model);
  const freshInput = Math.max(0, u.inputTokens - u.cachedInputTokens);
  const tokenCost =
    (freshInput * p.input +
      u.cachedInputTokens * p.input * 0.1 +
      (u.cacheWriteTokens ?? 0) * p.input * 1.25 +
      u.outputTokens * p.output) /
    1_000_000;
  const searchCost = ((u.webSearchRequests ?? 0) * WEB_SEARCH_USD_PER_1K) / 1_000;
  return Math.round((tokenCost + searchCost) * 1e6) / 1e6;
}
