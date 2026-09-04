import { describe, expect, it } from "vitest";
import { companyMatches, roleRelevance, roundKey } from "@/lib/match";

describe("companyMatches", () => {
  it("matches with/without suffixes and casing", () => {
    expect(companyMatches("Flipkart", "Flipkart ")).toBe(true);
    expect(companyMatches("Wissen", "Wissen technology")).toBe(true);
    expect(companyMatches("Google", "Google India")).toBe(true);
  });
  it("rejects unrelated companies", () => {
    expect(companyMatches("Flipkart", "Amazon")).toBe(false);
  });
});

describe("roleRelevance", () => {
  it("keeps the same title", () => {
    expect(roleRelevance("Java Developer", "Java Developer", "B2_5")).toBe("match");
  });
  it("flags a different level number as ambiguous", () => {
    expect(roleRelevance("SDE 2", "SDE 1", "LT2")).toBe("ambiguous");
  });
  it("rejects a clearly different discipline", () => {
    expect(roleRelevance("SDE 2", "Data Analyst", "B2_5")).toBe("reject");
  });
});

describe("roundKey", () => {
  it("normalises round labels", () => {
    expect(roundKey("R1")).toBe("r1");
    expect(roundKey("R1 - Technical")).toBe("r1");
    expect(roundKey("Round 2")).toBe("r2");
    expect(roundKey("Hiring Manager")).toBe("hr");
  });
});
