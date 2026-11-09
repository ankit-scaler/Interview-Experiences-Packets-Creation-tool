import { describe, expect, it } from "vitest";
import {
  ADDONS_MAX,
  addOnsNeedsToggle,
  companyConfirmed,
  isSameIdSet,
  moveId,
  normalizeAddOns,
  packetResetData,
} from "@/lib/sections";

describe("normalizeAddOns", () => {
  it("treats empty / whitespace / null as not added", () => {
    expect(normalizeAddOns("")).toBeNull();
    expect(normalizeAddOns("  \n\t ")).toBeNull();
    expect(normalizeAddOns(null)).toBeNull();
    expect(normalizeAddOns(undefined)).toBeNull();
  });
  it("trims real content", () => {
    expect(normalizeAddOns("  - bring ID  \n")).toBe("- bring ID");
  });
  it("exposes the max length", () => {
    expect(ADDONS_MAX).toBe(20000);
  });
});

describe("addOnsNeedsToggle", () => {
  it("short 1-3 line text needs no Read more", () => {
    expect(addOnsNeedsToggle("Bring your laptop.")).toBe(false);
    expect(addOnsNeedsToggle("a\nb\nc")).toBe(false);
  });
  it("long or >3 non-empty lines needs the toggle", () => {
    expect(addOnsNeedsToggle("x".repeat(200))).toBe(true);
    expect(addOnsNeedsToggle("a\nb\nc\nd")).toBe(true);
  });
  it("blank lines do not count as lines", () => {
    expect(addOnsNeedsToggle("a\n\n\nb\n\nc")).toBe(false);
  });
});

describe("moveId", () => {
  it("moves up and down", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });
  it("is a no-op at the ends or for unknown ids", () => {
    expect(moveId(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "zzz", 1)).toEqual(["a", "b"]);
  });
  it("does not mutate its input", () => {
    const ids = ["a", "b"];
    moveId(ids, "a", 1);
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("isSameIdSet", () => {
  it("accepts a permutation", () => {
    expect(isSameIdSet(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });
  it("rejects missing, extra, foreign and duplicate ids", () => {
    expect(isSameIdSet(["a", "b"], ["a"])).toBe(false);
    expect(isSameIdSet(["a", "b"], ["a", "b", "c"])).toBe(false);
    expect(isSameIdSet(["a", "b"], ["a", "x"])).toBe(false);
    expect(isSameIdSet(["a", "b"], ["a", "a"])).toBe(false);
  });
});

describe("companyConfirmed", () => {
  it("matches exactly, ignoring surrounding spaces", () => {
    expect(companyConfirmed(" Flipkart ", "Flipkart")).toBe(true);
  });
  it("is case-sensitive and rejects blank / partial", () => {
    expect(companyConfirmed("flipkart", "Flipkart")).toBe(false);
    expect(companyConfirmed("", "Flipkart")).toBe(false);
    expect(companyConfirmed("Flip", "Flipkart")).toBe(false);
  });
});

describe("packetResetData", () => {
  it("never touches addOns unless asked", () => {
    expect("addOns" in packetResetData(false)).toBe(false);
  });
  it("clears addOns when asked", () => {
    expect(packetResetData(true).addOns).toBeNull();
  });
  it("resets generation state and unpublishes", () => {
    expect(packetResetData(false)).toEqual({
      jdSummary: null,
      lastSheetRowDate: null,
      lastGeneratedAt: null,
      status: "DRAFT",
    });
  });
});
