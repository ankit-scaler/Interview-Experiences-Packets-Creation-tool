import type { Track } from "@prisma/client";
import { db } from "@/lib/db";
import { env, hasGoogleSheets } from "@/lib/env";
import type { RepoRow } from "@/lib/generation/types";
import { parseSheetDate, sheetsClient } from "./client";
import { fixtureRows } from "./fixture";

export const TRACK_TAB: Record<Track, string> = {
  ACADEMY: "Questions | Academy",
  DEVOPS: "Questions | DevOps",
  AIML: "Questions | AIML",
  DSML: "Questions | DSML",
};

type CanonicalField =
  | "company"
  | "role"
  | "round"
  | "status"
  | "isRelevant"
  | "question"
  | "solution"
  | "relatedModule"
  | "relatedTopic"
  | "dateAdded"
  | "jobId"
  | "userId"
  | "email";

const ALIASES: Record<CanonicalField, string[]> = {
  company: ["company"],
  role: ["role"],
  round: ["round", "round - name", "round name", "# round - name"],
  status: ["status", "final status"],
  isRelevant: ["is question relevant"],
  question: [
    "question (including followups)",
    "question including followups",
    "question",
    "questions asked",
  ],
  solution: ["solutions", "solution given by learner", "solution"],
  relatedModule: ["related module"],
  relatedTopic: ["related topic"],
  dateAdded: ["date added", "date added to sheet"],
  jobId: ["job id"],
  userId: ["user id"],
  email: ["email"],
};

function cleanHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\\?[#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9()\- ]/g, "")
    .trim();
}

/** Map a header row to { canonicalField: columnIndex }. */
export function resolveColumns(headerRow: string[]): Partial<Record<CanonicalField, number>> {
  const cleaned = headerRow.map(cleanHeader);
  const out: Partial<Record<CanonicalField, number>> = {};
  for (const field of Object.keys(ALIASES) as CanonicalField[]) {
    const aliases = ALIASES[field];
    let idx = cleaned.findIndex((h) => aliases.includes(h));
    if (idx < 0) idx = cleaned.findIndex((h) => aliases.some((a) => h.startsWith(a)));
    if (idx < 0) idx = cleaned.findIndex((h) => aliases.some((a) => h.includes(a)));
    if (idx >= 0) out[field] = idx;
  }
  return out;
}

function boolish(v: string): boolean {
  return /^(true|yes|1)$/i.test(v.trim());
}

function rowsFromValues(tab: string, values: string[][]): RepoRow[] {
  if (!values.length) return [];
  const cols = resolveColumns(values[0]);
  if (cols.question === undefined) return [];
  const get = (row: string[], f: CanonicalField) =>
    cols[f] !== undefined ? (row[cols[f] as number] ?? "").toString().trim() : "";

  const out: RepoRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row) continue;
    const question = get(row, "question");
    if (!question || question.length < 5) continue; // skip blank/instruction-only rows
    const dateAdded = get(row, "dateAdded");
    out.push({
      rowIndex: i + 1,
      tab,
      company: get(row, "company"),
      role: get(row, "role"),
      round: get(row, "round") || "R1",
      status: get(row, "status"),
      isRelevant: cols.isRelevant === undefined ? true : boolish(get(row, "isRelevant")),
      question,
      solution: get(row, "solution"),
      relatedModule: get(row, "relatedModule"),
      relatedTopic: get(row, "relatedTopic"),
      dateAdded,
      dateAddedTs: parseSheetDate(dateAdded),
      jobId: get(row, "jobId"),
      userId: get(row, "userId"),
      email: get(row, "email"),
    });
  }
  return out;
}

async function fetchTab(tab: string): Promise<RepoRow[]> {
  const sheets = sheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.repoSheetId,
    range: `'${tab}'!A1:AR20000`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const values = (res.data.values ?? []).map((r) => r.map((c) => (c == null ? "" : String(c))));
  return rowsFromValues(tab, values);
}

/**
 * Repo rows for a track, cached in SheetSnapshot. `maxAgeMinutes` = 0 forces refresh.
 */
export async function getRepoRows(
  track: Track,
  opts: { maxAgeMinutes?: number } = {},
): Promise<RepoRow[]> {
  if (!hasGoogleSheets()) return fixtureRows(track);

  const tab = TRACK_TAB[track];
  const maxAge = (opts.maxAgeMinutes ?? 720) * 60_000;
  const snap = await db.sheetSnapshot.findUnique({ where: { tab } });
  if (snap && Date.now() - snap.fetchedAt.getTime() < maxAge) {
    return snap.rows as unknown as RepoRow[];
  }
  const rows = await fetchTab(tab);
  await db.sheetSnapshot.upsert({
    where: { tab },
    create: { tab, rows: rows as unknown as object },
    update: { rows: rows as unknown as object, fetchedAt: new Date() },
  });
  return rows;
}
