/**
 * Centralised environment access. Keeps `process.env` lookups in one place and
 * fails loudly (in server code) when a required variable is missing.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/**
 * Normalise a service-account private key from an env var into a valid PEM.
 * Handles: literal `\n`, double-escaped `\\n`, CRLF, accidental wrapping quotes,
 * and a base64-encoded whole key (recommended — set GOOGLE_SA_PRIVATE_KEY_BASE64).
 */
function resolvePrivateKey(): string {
  const b64 = process.env.GOOGLE_SA_PRIVATE_KEY_BASE64;
  let key = b64
    ? Buffer.from(b64.trim(), "base64").toString("utf8")
    : required("GOOGLE_SA_PRIVATE_KEY");

  key = key.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!key.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "GOOGLE_SA_PRIVATE_KEY does not look like a PEM key. Copy the full `private_key` " +
        "value from the service-account JSON (or set GOOGLE_SA_PRIVATE_KEY_BASE64 to a " +
        "base64 of it).",
    );
  }
  return key;
}

export const env = {
  // App
  appUrl: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  adminEmailDomain: optional("ADMIN_EMAIL_DOMAIN", "scaler.com").toLowerCase(),
  contactEmail: optional("CONTACT_EMAIL", "ankit.mishra@scaler.com"),
  cronSecret: optional("CRON_SECRET"),

  // Anthropic
  // All models are reached through OpenRouter (OpenAI-compatible gateway).
  openRouterApiKey: optional("OPENROUTER_API_KEY"),
  openRouterBaseUrl: optional("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
  llmModel: optional("LLM_MODEL", "anthropic/claude-sonnet-5"),
  llmModelCheap: optional("LLM_MODEL_CHEAP", "anthropic/claude-haiku-4.5"),
  /** OpenRouter web-search engine; "exa" is the cheapest general option. */
  webSearchEngine: optional("WEB_SEARCH_ENGINE", "exa"),
  maxPacketCostUsd: Number(optional("MAX_PACKET_COST_USD", "0.5")),
  // Web searches are billed per request ($0.01 each) — these are the main cost dials.
  webSearchMaxResults: Number(optional("WEB_SEARCH_MAX_RESULTS", "5")),
  linkSearchMaxResults: Number(optional("LINK_SEARCH_MAX_RESULTS", "5")),
  linkLookupMaxQuestions: Number(optional("LINK_LOOKUP_MAX_QUESTIONS", "12")),

  // Google Sheets
  repoSheetId: optional("REPO_SHEET_ID", "10jyG2WkaTRtBTwm0lLQWogLibqLU6qAGr5OhKh9xcoE"),
  trackingSheetId: optional(
    "TRACKING_SHEET_ID",
    "1OT9Xr2W87LAj-PT87P0Mj9J1uuRRWQB9dVaH57xFZ9Y",
  ),
  googleSaEmail: () => required("GOOGLE_SA_EMAIL"),
  googleSaPrivateKey: resolvePrivateKey,
} as const;

export function hasLlm(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function hasGoogleSheets(): boolean {
  return Boolean(
    process.env.GOOGLE_SA_EMAIL &&
      (process.env.GOOGLE_SA_PRIVATE_KEY || process.env.GOOGLE_SA_PRIVATE_KEY_BASE64),
  );
}
