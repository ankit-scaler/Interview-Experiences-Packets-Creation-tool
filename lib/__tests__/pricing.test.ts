import { describe, expect, it } from "vitest";
import { costUsd } from "@/lib/llm/pricing";

const M = 1_000_000;
const HAIKU = "anthropic/claude-haiku-4.5";
const SONNET = "anthropic/claude-sonnet-5";

describe("costUsd", () => {
  it("uses OpenRouter's reported cost when it exceeds the token estimate", () => {
    // ~28k in + 3k out on sonnet ≈ $0.086 estimate; reported (incl. search fees)
    // is higher, so it wins.
    const c = costUsd(SONNET, {
      inputTokens: 28_000,
      outputTokens: 3_000,
      cachedInputTokens: 0,
      reportedCostUsd: 0.4213,
    });
    expect(c).toBeCloseTo(0.4213, 6);
  });

  it("uses the token estimate as a floor when OpenRouter reports 0 (not finalised)", () => {
    expect(
      costUsd(SONNET, {
        inputTokens: M,
        outputTokens: M,
        cachedInputTokens: 0,
        reportedCostUsd: 0,
      }),
    ).toBeCloseTo(12, 6); // sonnet estimate: $2/M in + $10/M out
  });

  it("falls back to the table estimate when no cost is reported", () => {
    expect(costUsd(HAIKU, { inputTokens: M, outputTokens: M, cachedInputTokens: 0 })).toBeCloseTo(6, 6);
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
