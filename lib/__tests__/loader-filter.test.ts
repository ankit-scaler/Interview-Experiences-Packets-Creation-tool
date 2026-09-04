import { describe, expect, it } from "vitest";
import { shouldTrackRequest } from "@/lib/loader-filter";

describe("shouldTrackRequest", () => {
  it("never touches the auth flow (a patched fetch here breaks sign-in)", () => {
    expect(shouldTrackRequest("/api/auth/csrf", "GET")).toBe(false);
    expect(shouldTrackRequest("/api/auth/signin/google", "POST")).toBe(false);
    expect(shouldTrackRequest("/api/auth/callback/google", "POST")).toBe(false);
    expect(shouldTrackRequest("http://localhost:3000/api/auth/session", "GET")).toBe(false);
  });

  it("ignores background pollers", () => {
    expect(shouldTrackRequest("/api/p/some-slug/read", "POST")).toBe(false);
    expect(shouldTrackRequest("/api/p/some-slug/heartbeat", "POST")).toBe(false);
    expect(shouldTrackRequest("/api/vault-click", "POST")).toBe(false);
    expect(shouldTrackRequest("/api/packets/abc123/job", "GET")).toBe(false);
    expect(shouldTrackRequest("/api/packets/abc123/generate?retry=1", "POST")).toBe(false);
    expect(shouldTrackRequest("/api/suggest?track=ACADEMY", "GET")).toBe(false);
  });

  it("tracks user-initiated mutations", () => {
    expect(shouldTrackRequest("/api/packets", "POST")).toBe(true);
    expect(shouldTrackRequest("/api/packets/abc/publish", "POST")).toBe(true);
    expect(shouldTrackRequest("/api/questions/xyz", "PATCH")).toBe(true);
    expect(shouldTrackRequest("/api/questions/xyz", "DELETE")).toBe(true);
    expect(shouldTrackRequest("/api/tracking/sync", "POST")).toBe(true);
    expect(shouldTrackRequest("/api/p/slug/feedback", "POST")).toBe(true);
  });

  it("tracks CSV downloads but not other GETs", () => {
    expect(shouldTrackRequest("/api/tracking/export?report=reads", "GET")).toBe(true);
    expect(shouldTrackRequest("/api/tracking/learner?email=a@b.com", "GET")).toBe(false);
  });

  it("ignores non-API requests entirely", () => {
    expect(shouldTrackRequest("/packets", "GET")).toBe(false);
    expect(shouldTrackRequest("https://example.com/thing", "POST")).toBe(false);
  });

  it("is case-insensitive on method", () => {
    expect(shouldTrackRequest("/api/packets", "post")).toBe(true);
    expect(shouldTrackRequest("/api/tracking/learner", "get")).toBe(false);
  });
});
