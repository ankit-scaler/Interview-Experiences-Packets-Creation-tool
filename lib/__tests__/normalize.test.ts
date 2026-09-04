import { describe, expect, it } from "vitest";
import {
  normalizeCompany,
  normalizeRole,
  normalizeQuestion,
  questionSimilarity,
} from "@/lib/normalize";

describe("normalizeCompany", () => {
  it("strips common suffixes and punctuation", () => {
    expect(normalizeCompany("Flipkart ")).toBe("flipkart");
    expect(normalizeCompany("Wissen Technology")).toBe("wissen");
    expect(normalizeCompany("Helical IT Solutions")).toBe("helical it");
    expect(normalizeCompany("Irona.ai")).toBe("irona ai");
  });
});

describe("normalizeRole", () => {
  it("canonicalises seniority words", () => {
    expect(normalizeRole("Sr. Software Engineer")).toContain("senior");
    expect(normalizeRole("SDE 2")).toBe("sde 2");
  });
});

describe("normalizeQuestion + similarity", () => {
  it("drops problem-link tails", () => {
    const a = normalizeQuestion("Reverse a linked list. Problem Link: Reverse Linked List – LeetCode");
    const b = normalizeQuestion("Reverse a linked list");
    expect(questionSimilarity(a, b)).toBeGreaterThan(0.8);
  });

  it("treats reworded duplicates as similar", () => {
    const a = normalizeQuestion("What is the difference between an INNER JOIN and a LEFT JOIN?");
    const b = normalizeQuestion("Explain the difference between INNER JOIN and LEFT JOIN in SQL");
    expect(questionSimilarity(a, b)).toBeGreaterThan(0.6);
  });

  it("keeps unrelated questions far apart", () => {
    const a = normalizeQuestion("Explain Java access modifiers");
    const b = normalizeQuestion("Design a rate limiter for a distributed system");
    expect(questionSimilarity(a, b)).toBeLessThan(0.3);
  });
});
