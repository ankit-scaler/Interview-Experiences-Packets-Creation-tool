import { describe, expect, it } from "vitest";
import { costUsd } from "@/lib/llm/pricing";

const M = 1_000_000;
const HAIKU = "anthropic/claude-haiku-4.5";
const SONNET = "anthropic/claude-sonnet-5";

describe("costUsd", () => {
  it("prefers the cost OpenRouter actually billed, ignoring the estimate", () => {
    const c = costUsd(SONNET, {
      inputTokens: M,
      outputTokens: M,
      cachedInputTokens: 0,
      reportedCostUsd: 0.4213,
    });
    expect(c).toBeCloseTo(0.4213, 6);
  });

  it("treats a reported cost of 0 as authoritative (free/promo credits)", () => {
    expect(
      costUsd(SONNET, {
        inputTokens: M,
        outputTokens: M,
        cachedInputTokens: 0,
        reportedCostUsd: 0,
      }),
    ).toBe(0);
  });

  it("falls back to the table when no cost is reported", () => {
    // haiku-4.5 = $1/MTok in, $5/MTok out
    expect(costUsd(HAIKU, { inputTokens: M, outputTokens: M, cachedInputTokens: 0 })).toBeCloseTo(6, 6);
    // sonnet-5 = $2/MTok in, $10/MTok out
    expect(costUsd(SONNET, { inputTokens: M, outputTokens: M, cachedInputTokens: 0 })).toBeCloseTo(12, 6);
  });

  it("charges cache reads at 10% and never double-counts them as fresh input", () => {
    expect(
      costUsd(HAIKU, { inputTokens: M, outputTokens: 0, cachedInputTokens: M }),
    ).toBeCloseTo(0.1, 6);
  });

  it("charges cache writes at 125%", () => {
    expect(
      costUsd(HAIKU, {
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        cacheWriteTokens: M,
      }),
    ).toBeCloseTo(1.25, 6);
  });

  it("adds per-request web-search cost to the fallback estimate", () => {
    // 10 searches at $0.007 = $0.07
    expect(
      costUsd(SONNET, {
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        webSearchRequests: 10,
      }),
    ).toBeCloseTo(0.07, 6);
  });

  it("falls back to a conservative rate for an unknown model", () => {
    expect(costUsd("some/future-model", { inputTokens: M, outputTokens: 0, cachedInputTokens: 0 }))
      .toBeGreaterThan(0);
  });

  it("is zero for a call that used nothing", () => {
    expect(costUsd(HAIKU, { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 })).toBe(0);
  });
});
