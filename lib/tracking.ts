import { db } from "@/lib/db";
import { buildAllReports, parseRange, type DateRange, type Report } from "@/lib/reports";
import { NOT_INTERNAL, NOT_INTERNAL_VIA_READ } from "@/lib/internal";

export interface ReadLogRow {
  email: string;
  company: string;
  role: string;
  track: string;
  firstRead: string;
  lastRead: string;
  days: number;
  timeSpent: string;
  link: string;
}

export interface TrackingSummary {
  from: string;
  to: string;
  packetsCreated: number;
  packetsNew: number;
  packetsAppended: number;
  totalReads: number;
  uniqueLearners: number;
  readLogCount: number;
  packetsWithNoReads: number;
  llmCost: number;
  avgSecondsPerLearnerPacket: number;
  repeatReadPairs: number;
  vaultClicks: number;
  feedbackCount: number;
  topPackets: { company: string; role: string; slug: string; reads: number }[];
  recentFeedback: { company: string; role: string; stars: number; matched: string; comment: string | null }[];
  readLog: ReadLogRow[];
  lastReadsSyncAt: string | null;
  lastFeedbackSyncAt: string | null;
}

const num = (v: unknown) => Number(String(v).replace(/[$,]/g, "")) || 0;

/** Read a report cell by column header, so reordering headers can't silently break totals. */
function col(report: Report | undefined, row: (string | number)[], header: string): unknown {
  const i = report?.headers.indexOf(header) ?? -1;
  return i >= 0 ? row[i] : undefined;
}

export async function trackingSummary(
  fromStr?: string | null,
  toStr?: string | null,
): Promise<TrackingSummary> {
  const range: DateRange = parseRange(fromStr, toStr);
  const { from, to, fromDay, toDay } = range;

  const reports = await buildAllReports(range);
  const byKey = Object.fromEntries(reports.map((r) => [r.key, r])) as Record<string, Report>;

  const [days, feedbackRows, syncState] = await Promise.all([
    db.packetReadDay.findMany({
      where: { day: { gte: fromDay, lte: toDay }, NOT: NOT_INTERNAL_VIA_READ },
      select: { seconds: true, packetRead: { select: { userEmail: true } } },
    }),
    db.feedback.findMany({
      where: { createdAt: { gte: from, lte: to }, NOT: NOT_INTERNAL },
      include: { packet: { select: { company: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.syncState.findUnique({ where: { id: "singleton" } }),
  ]);

  const created = byKey["packets-created"]?.rows ?? [];
  const readsRows = byKey["reads"]?.rows ?? [];
  const timeRows = byKey["time-spent"]?.rows ?? [];
  const logRows = byKey["read-log"]?.rows ?? [];

  const totalActiveSeconds = days.filter((d) => d.seconds > 0).reduce((n, d) => n + d.seconds, 0);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    packetsCreated: created.length,
    packetsNew: created.filter((r) => col(byKey["packets-created"], r, "Type") === "New").length,
    packetsAppended: created.filter((r) => col(byKey["packets-created"], r, "Type") === "Append")
      .length,
    totalReads: readsRows.reduce((n, r) => n + num(col(byKey["reads"], r, "Reads")), 0),
    uniqueLearners: new Set(days.map((d) => d.packetRead.userEmail)).size,
    readLogCount: logRows.length,
    packetsWithNoReads: byKey["no-reads"]?.rows.length ?? 0,
    llmCost: (byKey["llm-cost"]?.rows ?? []).reduce(
      (n, r) => n + num(col(byKey["llm-cost"], r, "Cost (USD)")),
      0,
    ),
    avgSecondsPerLearnerPacket:
      timeRows.length === 0 ? 0 : Math.round(totalActiveSeconds / timeRows.length),
    repeatReadPairs: byKey["repeat-reads"]?.rows.length ?? 0,
    vaultClicks: byKey["vault-clicks"]?.rows.length ?? 0,
    feedbackCount: feedbackRows.length,
    topPackets: readsRows.slice(0, 10).map((r) => ({
      company: String(col(byKey["reads"], r, "Company") ?? ""),
      role: String(col(byKey["reads"], r, "Role") ?? ""),
      slug: String(col(byKey["reads"], r, "Packet link") ?? "").split("/p/")[1] ?? "",
      reads: num(col(byKey["reads"], r, "Reads")),
    })),
    recentFeedback: feedbackRows.map((f) => ({
      company: f.packet.company,
      role: f.packet.role,
      stars: f.stars,
      matched: f.matched,
      comment: f.comment,
    })),
    readLog: logRows.slice(0, 200).map((r) => {
      const c = (h: string) => String(col(byKey["read-log"], r, h) ?? "");
      return {
        email: c("Learner email"),
        company: c("Company"),
        role: c("Role"),
        track: c("Track"),
        firstRead: c("First read"),
        lastRead: c("Last read"),
        days: num(col(byKey["read-log"], r, "Days read")),
        timeSpent: c("Time spent"),
        link: c("Packet link"),
      };
    }),
    lastReadsSyncAt: syncState?.lastReadsSyncAt?.toISOString() ?? null,
    lastFeedbackSyncAt: syncState?.lastFeedbackSyncAt?.toISOString() ?? null,
  };
}

export type TrackingData = TrackingSummary;
