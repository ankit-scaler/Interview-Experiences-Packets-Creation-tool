import { google } from "googleapis";
import { env, hasGoogleSheets } from "@/lib/env";

export class SheetsDisabledError extends Error {
  constructor() {
    super("GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY are not set — Sheets features are unavailable.");
    this.name = "SheetsDisabledError";
  }
}

export function sheetsClient() {
  if (!hasGoogleSheets()) throw new SheetsDisabledError();
  const auth = new google.auth.JWT({
    email: env.googleSaEmail(),
    key: env.googleSaPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/** Parse sheet date strings like "26-Aug-2025" / "2025-08-26" → epoch ms or null. */
export function parseSheetDate(raw: string): number | null {
  if (!raw) return null;
  const s = raw.trim();
  const dmy = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ](\d{4})$/);
  if (dmy) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const m = months.indexOf(dmy[2].slice(0, 3).toLowerCase());
    if (m >= 0) return new Date(Number(dmy[3]), m, Number(dmy[1])).getTime();
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}
