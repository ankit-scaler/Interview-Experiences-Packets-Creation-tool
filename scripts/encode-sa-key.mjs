#!/usr/bin/env node
/**
 * Turn a downloaded service-account JSON into the two env lines you need.
 * Usage:  node scripts/encode-sa-key.mjs ~/Downloads/interview-packets-xxxx.json
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/encode-sa-key.mjs <path-to-service-account.json>");
  process.exit(1);
}

const json = JSON.parse(readFileSync(path, "utf8"));
if (!json.client_email || !json.private_key) {
  console.error("That file doesn't look like a service-account key (no client_email / private_key).");
  process.exit(1);
}

const b64 = Buffer.from(json.private_key, "utf8").toString("base64");

console.log("\nPaste these into .env (replace any existing GOOGLE_SA_* lines):\n");
console.log(`GOOGLE_SA_EMAIL="${json.client_email}"`);
console.log(`GOOGLE_SA_PRIVATE_KEY_BASE64="${b64}"`);
console.log("\n(leave GOOGLE_SA_PRIVATE_KEY blank / removed — the base64 form avoids newline issues)\n");
