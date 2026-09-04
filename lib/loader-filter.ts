/**
 * Decides whether a request should raise the global loading indicator.
 * Kept pure (and out of the client component) so it can be unit-tested.
 */

/** Requests that fire on their own, or that must never be interfered with. */
const SILENT = [
  /\/api\/auth\//, // the auth flow — never touch it
  /\/api\/p\/[^/]+\/(read|heartbeat)$/, // read + time-on-page pings
  /\/api\/vault-click$/, // fire-and-forget click log
  /\/api\/packets\/[^/]+\/(job|generate)/, // generation poller (has its own UI)
  /\/api\/suggest\b/, // create-form autocomplete
];

export function shouldTrackRequest(url: string, method: string): boolean {
  if (!url.includes("/api/")) return false;
  if (SILENT.some((re) => re.test(url))) return false;
  // Mutations always count; GETs only when they're a user-initiated download.
  return method.toUpperCase() !== "GET" || url.includes("/export");
}
