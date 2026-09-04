import { describe, expect, it } from "vitest";
import { DEFAULT_RANGE_DAYS, parseRange } from "@/lib/reports";

const days = (r: { from: Date; to: Date }) =>
  Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000);

describe("parseRange", () => {
  it("defaults to the 7-day window, inclusive of today", () => {
    expect(DEFAULT_RANGE_DAYS).toBe(7);
    // 6 whole days plus the part-day to 23:59:59.999 => 7 calendar days.
    expect(days(parseRange())).toBe(6);
  });

  it("honours an explicit range", () => {
    const r = parseRange("2026-08-01", "2026-08-31");
    expect(r.from.getFullYear()).toBe(2026);
    expect(r.from.getMonth()).toBe(7);
    expect(r.from.getDate()).toBe(1);
    expect(r.to.getDate()).toBe(31);
  });

  it("covers the whole end day, so same-day ranges are not empty", () => {
    const r = parseRange("2026-09-04", "2026-09-04");
    expect(r.to.getTime()).toBeGreaterThan(r.from.getTime());
    expect(r.to.getHours()).toBe(23);
  });

  it("exposes UTC-midnight day bounds for @db.Date columns", () => {
    const r = parseRange("2026-09-04", "2026-09-04");
    expect(r.fromDay.toISOString()).toBe("2026-09-04T00:00:00.000Z");
    expect(r.toDay.toISOString()).toBe("2026-09-04T00:00:00.000Z");
  });
});
