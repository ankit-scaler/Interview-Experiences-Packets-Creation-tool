import { describe, expect, it } from "vitest";
import { isInternalEmail } from "@/lib/internal";

describe("isInternalEmail", () => {
  it("treats Scaler staff as internal", () => {
    expect(isInternalEmail("ankit.mishra@scaler.com")).toBe(true);
    expect(isInternalEmail("topics-content@scaler.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isInternalEmail("Ankit.Mishra@Scaler.com")).toBe(true);
    expect(isInternalEmail("SOMEONE@SCALER.COM")).toBe(true);
  });

  it("treats learners as external", () => {
    expect(isInternalEmail("learner@gmail.com")).toBe(false);
    expect(isInternalEmail("someone@outlook.com")).toBe(false);
  });

  it("does not match look-alike domains", () => {
    // Must be the actual domain, not merely contain it.
    expect(isInternalEmail("someone@notscaler.com")).toBe(false);
    expect(isInternalEmail("someone@scaler.com.evil.com")).toBe(false);
    expect(isInternalEmail("scaler.com@gmail.com")).toBe(false);
  });

  it("handles missing values", () => {
    expect(isInternalEmail(null)).toBe(false);
    expect(isInternalEmail(undefined)).toBe(false);
    expect(isInternalEmail("")).toBe(false);
  });
});
