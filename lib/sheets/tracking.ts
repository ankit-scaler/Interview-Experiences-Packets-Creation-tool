import { env } from "@/lib/env";
import { sheetsClient } from "./client";

export const READS_TAB = "Packet Reads";
export const READ_DETAILS_TAB = "Read Details";
export const FEEDBACK_TAB = "Feedback";

const HEADERS: Record<string, string[]> = {
  [READS_TAB]: [
    "Packet Name",
    "Packet Link",
    "Company",
    "Role",
    "Track",
    "Read Count",
    "Unique Learners",
    "Emails",
    "First Read",
    "Last Read",
    "Last Updated",
  ],
  [READ_DETAILS_TAB]: [
    "Packet Name",
    "Packet Link",
    "Learner Email",
    "First Read",
    "Last Read",
    "Days Read",
  ],
  [FEEDBACK_TAB]: [
    "Submitted At",
    "Company",
    "Role",
    "Packet Link",
    "Learner Email",
    "Stars",
    "Matched Interview",
    "Comment",
  ],
};

async function ensureTab(title: string) {
  const sheets = sheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: env.trackingSheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: env.trackingSheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
  const headers = HEADERS[title];
  if (headers) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: env.trackingSheetId,
      range: `'${title}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

/** Overwrite a tab with a fresh header + rows (used for raw-data dumps). */
export async function replaceSheet(title: string, headers: string[], rows: (string | number)[][]) {
  await ensureTab(title);
  const sheets = sheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: env.trackingSheetId,
    range: `'${title}'!A2:Z200000`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: env.trackingSheetId,
    range: `'${title}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers, ...rows.map((r) => r.map((c) => String(c)))] },
  });
}

async function readTab(title: string): Promise<string[][]> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.trackingSheetId,
    range: `'${title}'!A1:Z100000`,
  });
  return (res.data.values ?? []).map((r) => r.map((c) => (c == null ? "" : String(c))));
}

/**
 * Upsert rows into a tab keyed by a column index (0-based). Rows whose key
 * matches an existing row are overwritten in place; the rest are appended.
 */
export async function upsertRows(
  title: string,
  keyCol: number | number[],
  rows: string[][],
) {
  if (!rows.length) return;
  const keyCols = Array.isArray(keyCol) ? keyCol : [keyCol];
  const keyOf = (row: string[]) => keyCols.map((c) => (row[c] ?? "").trim().toLowerCase()).join("␟");
  await ensureTab(title);
  const sheets = sheetsClient();
  const existing = await readTab(title);
  const indexByKey = new Map<string, number>();
  for (let i = 1; i < existing.length; i++) {
    const key = keyOf(existing[i] ?? []);
    if (key.replace(/␟/g, "")) indexByKey.set(key, i);
  }

  const updates: { range: string; values: string[][] }[] = [];
  const appends: string[][] = [];
  for (const row of rows) {
    const key = keyOf(row);
    const at = indexByKey.get(key);
    if (at !== undefined) {
      updates.push({ range: `'${title}'!A${at + 1}`, values: [row] });
    } else {
      appends.push(row);
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: env.trackingSheetId,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
  if (appends.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.trackingSheetId,
      range: `'${title}'!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: appends },
    });
  }
}
