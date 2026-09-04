import { describe, expect, it, vi } from "vitest";

/**
 * `env` computes appUrl once at module load, so each case re-imports it with a
 * fresh module registry.
 */
async function appUrlWith(vars: Record<string, string | undefined>): Promise<string> {
  vi.resetModules();
  const saved = { ...process.env };
  for (const k of ["NEXT_PUBLIC_APP_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]) {
    delete process.env[k];
  }
  Object.assign(process.env, vars);
  const { env } = await import("@/lib/env");
  const url = env.appUrl;
  process.env = saved;
  return url;
}

describe("env.appUrl resolution", () => {
  it("prefers an explicit NEXT_PUBLIC_APP_URL", async () => {
    expect(
      await appUrlWith({
        NEXT_PUBLIC_APP_URL: "https://packets.scaler.com",
        VERCEL_PROJECT_PRODUCTION_URL: "ignored.vercel.app",
      }),
    ).toBe("https://packets.scaler.com");
  });

  it("strips a trailing slash so packet links don't double up", async () => {
    expect(await appUrlWith({ NEXT_PUBLIC_APP_URL: "https://packets.scaler.com/" })).toBe(
      "https://packets.scaler.com",
    );
  });

  it("falls back to Vercel's stable production URL when none is set", async () => {
    expect(
      await appUrlWith({ VERCEL_PROJECT_PRODUCTION_URL: "interview-packets.vercel.app" }),
    ).toBe("https://interview-packets.vercel.app");
  });

  it("falls back to the per-deployment VERCEL_URL on previews", async () => {
    expect(await appUrlWith({ VERCEL_URL: "app-git-branch-user.vercel.app" })).toBe(
      "https://app-git-branch-user.vercel.app",
    );
  });

  it("uses localhost when nothing is set", async () => {
    expect(await appUrlWith({})).toBe("http://localhost:3000");
  });
});
