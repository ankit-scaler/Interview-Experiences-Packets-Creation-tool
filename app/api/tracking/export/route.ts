import { guardAdmin, apiError } from "@/lib/api";
import { toCsv, toCsvBundle } from "@/lib/csv";
import { buildAllReports, buildReport, packetRoster, parseRange } from "@/lib/reports";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const report = url.searchParams.get("report");

  // The packet directory windows on last-created/edited date and defaults to
  // all-time (not the 30-day default the other reports use).
  const range =
    report === "packet-roster"
      ? parseRange(url.searchParams.get("from") || "2000-01-01", url.searchParams.get("to"))
      : parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
  const stamp = `${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}`;

  let csv: string;
  let name: string;

  if (report === "packet-roster") {
    const r = await packetRoster(range, {
      company: url.searchParams.get("company"),
      role: url.searchParams.get("role"),
    });
    csv = toCsv(r.headers, r.rows);
    name = `${r.key}_${stamp}.csv`;
  } else if (report) {
    const r = await buildReport(report, range);
    if (!r) return apiError("Unknown report", 404);
    csv = toCsv(r.headers, r.rows);
    name = `${r.key}_${stamp}.csv`;
  } else {
    const all = await buildAllReports(range);
    csv = toCsvBundle(all.map((r) => ({ title: r.title, headers: r.headers, rows: r.rows })));
    name = `packet-tracking_${stamp}.csv`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
