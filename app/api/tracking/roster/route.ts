import { guardAdmin, json } from "@/lib/api";
import { packetRoster, parseRange } from "@/lib/reports";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const guard = await guardAdmin();
  if (guard.error) return guard.error;

  const url = new URL(req.url);
  // Window on last-created/edited date; default to all-time when no start given.
  const range = parseRange(
    url.searchParams.get("from") || "2000-01-01",
    url.searchParams.get("to"),
  );
  const report = await packetRoster(range, {
    company: url.searchParams.get("company"),
    role: url.searchParams.get("role"),
  });
  return json({ headers: report.headers, rows: report.rows });
}
