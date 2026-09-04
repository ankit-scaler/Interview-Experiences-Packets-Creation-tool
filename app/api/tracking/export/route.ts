import { guardAdmin, apiError } from "@/lib/api";
import { toCsv, toCsvBundle } from "@/lib/csv";
import { buildAllReports, buildReport, parseRange } from "@/lib/reports";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("from"), url.searchParams.get("to"));
  const report = url.searchParams.get("report");
  const stamp = `${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}`;

  let csv: string;
  let name: string;

  if (report) {
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
