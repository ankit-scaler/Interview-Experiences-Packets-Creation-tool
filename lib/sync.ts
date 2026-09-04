/**
 * DB → Google Sheets mirror. DB is source of truth; failures never break the
 * user-facing request (call via syncSoon). Each report becomes its own tab,
 * fully rewritten on every sync.
 */
import { db } from "@/lib/db";
import { hasGoogleSheets } from "@/lib/env";
import { buildAllReports, parseRange } from "@/lib/reports";
import { replaceSheet } from "@/lib/sheets/tracking";

const TAB_FOR: Record<string, string> = {
  "packets-created": "Packets Created",
  reads: "Reads by Packet",
  "read-log": "Read Log",
  "no-reads": "Packets No Reads",
  "llm-cost": "LLM Cost",
  "time-spent": "Time Spent",
  "repeat-reads": "Repeat Reads",
  feedback: "Feedback",
  "vault-clicks": "Vault Clicks",
  "read-sessions": "Read Sessions",
};

/** All-time range for the mirror. */
function allTimeRange() {
  return parseRange("2000-01-01", "2099-12-31");
}

export async function syncAll(): Promise<{ ok: boolean; note?: string }[]> {
  if (!hasGoogleSheets()) return [{ ok: false, note: "Sheets not configured" }];

  const reports = await buildAllReports(allTimeRange());
  const results: { ok: boolean; note?: string }[] = [];

  for (const r of reports) {
    const tab = TAB_FOR[r.key] ?? r.title;
    try {
      // eslint-disable-next-line no-await-in-loop
      await replaceSheet(tab, r.headers, r.rows);
      results.push({ ok: true, note: `${tab}: ${r.rows.length} rows` });
    } catch (e) {
      results.push({ ok: false, note: `${tab}: ${e instanceof Error ? e.message : e}` });
    }
  }

  const now = new Date();
  await db.syncState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastReadsSyncAt: now, lastFeedbackSyncAt: now },
    update: { lastReadsSyncAt: now, lastFeedbackSyncAt: now },
  });
  return results;
}

/**
 * Called after a learner read / feedback / vault click. A full 9-tab rewrite is
 * too heavy to run on every page view, so the Sheets mirror is refreshed by the
 * nightly cron and the "Sync to Sheets" button. This is intentionally a no-op —
 * kept as the hook point if a lighter incremental push is added later.
 */
export function syncSoon() {
  /* no-op: see cron `/api/cron/sync` and the manual Sync button */
}
