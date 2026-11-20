import { describe, expect, it } from "vitest";
import {
  canonicalRoundName,
  findExistingRound,
  kindKey,
  planOrder,
  roundKind,
  type RoundRef,
} from "@/lib/rounds";

const r = (
  id: string,
  name: string,
  order: number,
  sheetKey: string | null = null,
  isSpillover = false,
): RoundRef => ({ id, name, order, sheetKey, isSpillover });

describe("roundKind", () => {
  it.each([
    ["Online Assessment (HackerEarth / LeetCode platform)", "oa"],
    ["Round 0 – Online Assessment", "oa"],
    ["OA", "oa"],
    ["Coding Assessment (HackerRank)", "oa"],
    ["Hiring Manager Round", "hiring-manager"],
    ["Hiring Manger Round", "hiring-manager"],
    ["HIRING MANAGER ROUND", "hiring-manager"],
    [" hiring  manager ", "hiring-manager"],
    ["Hiring-Manager Round", "hiring-manager"],
    ["Hiring Manager", "hiring-manager"],
    ["Round 4 – High-Level Design / Hiring Manager Round", "hiring-manager"],
    ["Round 5 – HR / Behavioural", "hr"],
    ["HR Round", "hr"],
    ["Culture Fit", "hr"],
    ["Ｈｒ Round", "hr"], // fullwidth "Hr" normalises
    ["ΗR Round", "other"], // Greek Eta lookalike stays other
    ["R1 – Technical", "other"],
    ["Bar Raiser", "other"],
    ["Managerial Round", "other"],
    ["Chromium Internals", "other"],
    ["Three Sum Round", "other"],
    ["Shrinking Window Round", "other"],
    ["Brunch Round", "other"],
  ])("%s -> %s", (name, kind) => {
    expect(roundKind(name)).toBe(kind);
  });
});

describe("canonicalRoundName", () => {
  it("OA is always 'Online Assessment'", () => {
    expect(canonicalRoundName("Round 0 – Online Assessment (HackerEarth / LeetCode platform)")).toBe(
      "Online Assessment",
    );
    expect(canonicalRoundName("OA")).toBe("Online Assessment");
  });
  it("single-kind Hiring Manager spellings collapse to one name", () => {
    for (const n of ["Hiring Manager Round", "Hiring Manger Round", "HM Round", "Round 6 – Hiring Manager"]) {
      expect(canonicalRoundName(n)).toBe("Hiring Manager");
    }
  });
  it("combined round keeps its other part, with a standard HM token", () => {
    expect(canonicalRoundName("Round 4 – High-Level Design / Hiring Manager Round")).toBe(
      "Round 4 – High-Level Design / Hiring Manager",
    );
  });
  it("single-kind HR is 'HR / Behavioural'", () => {
    expect(canonicalRoundName("HR Round")).toBe("HR / Behavioural");
    expect(canonicalRoundName("Round 5 – HR / Behavioural")).toBe("HR / Behavioural");
  });
  it("leaves technical and other rounds alone", () => {
    expect(canonicalRoundName("R1 – Technical")).toBe("R1 – Technical");
    expect(canonicalRoundName("Bar Raiser")).toBe("Bar Raiser");
    expect(canonicalRoundName("  Machine   Coding ")).toBe("Machine Coding");
  });
});

describe("kindKey", () => {
  it("shares a key across sheet + web spellings of a special kind", () => {
    expect(kindKey({ key: "r5", name: "R5 – Hiring Manager" })).toBe(
      kindKey({ key: "hr", name: "Hiring Manager Round" }),
    );
  });
  it("keeps numbered technical rounds apart", () => {
    expect(kindKey({ key: "r1", name: "R1 – Technical" })).not.toBe(
      kindKey({ key: "r2", name: "R2 – Technical" }),
    );
  });
});

describe("findExistingRound", () => {
  const existing = [
    r("a", "Round 0 – Online Assessment (HackerEarth)", 0, "r0"),
    r("b", "R1 – Technical", 1, "r1"),
    r("c", "R2 – Technical", 2, "r2"),
    r("d", "Round 4 – High-Level Design / Hiring Manager Round", 3, "r4"),
    r("e", "Round 5 – HR / Behavioural", 4, "r5"),
    r("f", "Frequently Asked Question Based on JD", 900, "jd-spillover", true),
  ];
  it("puts 'Hiring Manager Round' into the combined HLD / HM round", () => {
    expect(findExistingRound({ key: "hr", name: "Hiring Manager Round" }, existing)?.id).toBe("d");
  });
  it("keeps HR and Hiring Manager separate", () => {
    expect(findExistingRound({ key: "hr", name: "HR / Behavioural" }, existing)?.id).toBe("e");
  });
  it("matches OA by kind, not just key", () => {
    expect(findExistingRound({ key: "oa", name: "Online Assessment" }, existing)?.id).toBe("a");
  });
  it("matches technical rounds by exact key only", () => {
    expect(findExistingRound({ key: "r2", name: "R2 – Technical" }, existing)?.id).toBe("c");
    expect(findExistingRound({ key: "r3", name: "R3 – Technical" }, existing)).toBeUndefined();
  });
  it("never lets a normal round match the spillover round", () => {
    expect(findExistingRound({ key: "jd-spillover", name: "Other", isSpillover: false }, existing)).toBeUndefined();
  });
  it("matches the spillover draft to the spillover round", () => {
    expect(
      findExistingRound({ key: "jd-spillover", name: "Frequently Asked Question Based on JD", isSpillover: true }, existing)?.id,
    ).toBe("f");
  });
});

describe("planOrder", () => {
  const six = [
    r("1", "R1 – Technical", 0, "r1"),
    r("2", "R2 – Technical", 1, "r2"),
    r("3", "R3 – Technical", 2, "r3"),
    r("4", "R4 – Technical", 3, "r4"),
    r("5", "R5 – Technical", 4, "r5"),
    r("6", "R6 – Technical", 5, "r6"),
    r("s", "Frequently Asked Question Based on JD", 900, "jd-spillover", true),
  ];
  it("OA from a later pull goes first and shifts the rest", () => {
    const p = planOrder(six, { key: "oa", name: "Online Assessment" });
    expect(p.order).toBe(0);
    expect(p.shifts).toEqual([
      { id: "1", order: 1 },
      { id: "2", order: 2 },
      { id: "3", order: 3 },
      { id: "4", order: 4 },
      { id: "5", order: 5 },
      { id: "6", order: 6 },
    ]);
  });
  it("a new r7 goes after r6, spillover untouched", () => {
    const p = planOrder(six, { key: "r7", name: "R7 – Technical" });
    expect(p).toEqual({ order: 6, shifts: [] });
  });
  it("a new hr round goes after technical rounds", () => {
    const p = planOrder(six, { key: "hr", name: "HR / Behavioural" });
    expect(p.order).toBe(6);
    expect(p.shifts).toEqual([]);
  });
  it("preserves an admin's manual order (only new rounds are placed)", () => {
    const manual = [r("x", "R3 – Technical", 0, "r3"), r("y", "R1 – Technical", 1, "r1")];
    expect(planOrder(manual, { key: "r4", name: "R4 – Technical" })).toEqual({ order: 2, shifts: [] });
  });
  it("spillover drafts are not placed here", () => {
    expect(planOrder(six, { key: "jd-spillover", name: "x", isSpillover: true }).order).toBe(900);
  });
  it("works on an empty packet", () => {
    expect(planOrder([], { key: "r1", name: "R1" })).toEqual({ order: 0, shifts: [] });
  });
});
