import { describe, expect, it } from "vitest";
import {
  PREP_MAX,
  PREP_MAX_DELTA,
  clampPct,
  clampPrepSeconds,
  hashFor,
  makeSlugger,
  normalizePrep,
  parseReaderHash,
  scrollSeenPct,
} from "@/lib/prep";

describe("normalizePrep", () => {
  it("treats empty / whitespace / null as not added", () => {
    expect(normalizePrep("")).toBeNull();
    expect(normalizePrep(" \n\t ")).toBeNull();
    expect(normalizePrep(null)).toBeNull();
    expect(normalizePrep(undefined)).toBeNull();
  });
  it("trims real content", () => {
    expect(normalizePrep("  # Kit\n")).toBe("# Kit");
  });
  it("exposes a max length above the Add-Ons cap", () => {
    expect(PREP_MAX).toBe(60000);
  });
});

describe("parseReaderHash", () => {
  it("opens the kit for #prep when a kit exists", () => {
    expect(parseReaderHash("#prep", 3, true)).toBe("prep");
  });
  it("defaults to the kit with no hash when a kit exists", () => {
    expect(parseReaderHash("", 3, true)).toBe("prep");
  });
  it("defaults to R1 with no hash and no kit", () => {
    expect(parseReaderHash("", 3, false)).toBe(0);
  });
  it("#prep without a kit falls back to R1", () => {
    expect(parseReaderHash("#prep", 3, false)).toBe(0);
  });
  it("parses #rN to a 0-based index", () => {
    expect(parseReaderHash("#r2", 3, true)).toBe(1);
    expect(parseReaderHash("#r1", 3, false)).toBe(0);
  });
  it("out-of-range or junk hashes fall back to the default", () => {
    expect(parseReaderHash("#r9", 3, true)).toBe("prep");
    expect(parseReaderHash("#r0", 3, false)).toBe(0);
    expect(parseReaderHash("#nope", 3, true)).toBe("prep");
    expect(parseReaderHash("#r2x", 3, false)).toBe(0);
  });
  it("works with zero rounds", () => {
    expect(parseReaderHash("#prep", 0, true)).toBe("prep");
    expect(parseReaderHash("", 0, true)).toBe("prep");
  });
});

describe("hashFor", () => {
  it("round-trips with parseReaderHash", () => {
    expect(hashFor("prep")).toBe("#prep");
    expect(hashFor(0)).toBe("#r1");
    expect(hashFor(2)).toBe("#r3");
  });
});

describe("scrollSeenPct", () => {
  it("is 0 when the content is still below the fold", () => {
    expect(scrollSeenPct(900, 2000, 800)).toBe(0);
  });
  it("is proportional to how much has been scrolled into view", () => {
    expect(scrollSeenPct(300, 2000, 800)).toBe(25);
  });
  it("is 100 once the bottom has passed the viewport bottom", () => {
    expect(scrollSeenPct(-1500, 2000, 800)).toBe(100);
  });
  it("is 100 for content shorter than the viewport", () => {
    expect(scrollSeenPct(200, 300, 900)).toBe(100);
  });
  it("is 0 for zero-height / invalid input, never NaN", () => {
    expect(scrollSeenPct(0, 0, 800)).toBe(0);
    expect(scrollSeenPct(0, 100, 0)).toBe(0);
    expect(scrollSeenPct(NaN, 100, 800)).toBe(0);
  });
});

describe("clamps", () => {
  it("clampPct bounds to 0..100 and rejects garbage", () => {
    expect(clampPct(150)).toBe(100);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(33.6)).toBe(34);
    expect(clampPct("x")).toBe(0);
    expect(clampPct(undefined)).toBe(0);
    expect(clampPct(NaN)).toBe(0);
  });
  it("clampPrepSeconds bounds to 0..PREP_MAX_DELTA and rejects garbage", () => {
    expect(clampPrepSeconds(20)).toBe(20);
    expect(clampPrepSeconds(99999)).toBe(PREP_MAX_DELTA);
    expect(clampPrepSeconds(-4)).toBe(0);
    expect(clampPrepSeconds("12")).toBe(0);
    expect(clampPrepSeconds(NaN)).toBe(0);
    expect(clampPrepSeconds(Infinity)).toBe(0);
  });
});

describe("parseReaderHash with Add-Ons", () => {
  it("opens Add-Ons for #addons when they exist", () => {
    expect(parseReaderHash("#addons", 3, true, true)).toBe("addons");
    expect(parseReaderHash("#addons", 3, false, true)).toBe("addons");
  });
  it("#addons without Add-Ons falls back to the default", () => {
    expect(parseReaderHash("#addons", 3, true, false)).toBe("prep");
    expect(parseReaderHash("#addons", 3, false, false)).toBe(0);
    expect(parseReaderHash("#addons", 3, true)).toBe("prep");
  });
  it("hashFor handles addons", () => {
    expect(hashFor("addons")).toBe("#addons");
  });
});

describe("makeSlugger", () => {
  it("lower-cases, hyphenates and strips punctuation", () => {
    const slug = makeSlugger();
    expect(slug("What Nanoheal tests?")).toBe("what-nanoheal-tests");
    expect(slug("  1. How to use this kit ")).toBe("1-how-to-use-this-kit");
  });
  it("de-duplicates repeated headings in order", () => {
    const slug = makeSlugger();
    expect(slug("Setup")).toBe("setup");
    expect(slug("Setup")).toBe("setup-2");
    expect(slug("Setup")).toBe("setup-3");
  });
  it("never returns an empty id", () => {
    const slug = makeSlugger();
    expect(slug("!!!")).toBe("section");
    expect(slug("???")).toBe("section-2");
  });
  it("keeps unicode letters", () => {
    expect(makeSlugger()("Café basics")).toBe("café-basics");
  });
});
