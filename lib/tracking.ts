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
  scrollPct: number;
  link: string;
}

/** One point per calendar day in the picked range, zero-filled. */
export interface DailyPoint {
  /** YYYY-MM-DD (UTC), matching how PacketReadDay stores its day. */
  day: string;
  llmCost: number;
  reads: number;
  packetsCreated: number;
}

/**
 * All-time LLM spend figures. Deliberately independent of the date picker —
 * these answer "what has this tool cost us", not "what did this week cost".
 */
export interface LlmOverview {
  /** Mean spend across COMPLETE calendar months; null until one has elapsed. */
  avgPerMonth: number | null;
  completeMonths: number;
  totalSinceInception: number;
  publishedPackets: number;
  /** Σ lifetime cost of published packets ÷ published count. */
  costPerPublishedPacket: number | null;
  /** All spend (drafts included) ÷ published count — the true cost to ship. */
  costPerPublishedPacketInclWaste: number | null;
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
  daily: DailyPoint[];
  llmOverview: LlmOverview;
  lastReadsSyncAt: string | null;
  lastFeedbackSyncAt: string | null;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Per-day series for the dashboard charts. Every bucket is keyed by UTC date so
 * reads (stored as `@db.Date`), LLM calls and generation jobs all land on the
 * same day boundary.
 */
async function dailySeries({ from, to, fromDay, toDay }: DateRange): Promise<DailyPoint[]> {
  const [calls, days, jobs] = await Promise.all([
    db.llmCall.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { createdAt: true, costUsd: true },
    }),
    db.packetReadDay.findMany({
      where: { day: { gte: fromDay, lte: toDay }, NOT: NOT_INTERNAL_VIA_READ },
      select: { day: true },
    }),
    db.generationJob.findMany({
      where: { status: "SUCCEEDED", finishedAt: { gte: from, lte: to } },
      select: { finishedAt: true },
    }),
  ]);

  const buckets = new Map<string, DailyPoint>();
  // Zero-fill so a quiet day is a point at zero, not a gap in the line.
  for (let t = fromDay.getTime(); t <= toDay.getTime(); t += 86_400_000) {
    const key = dayKey(new Date(t));
    buckets.set(key, { day: key, llmCost: 0, reads: 0, packetsCreated: 0 });
  }
  const at = (d: Date) => buckets.get(dayKey(d));

  for (const c of calls) {
    const b = at(c.createdAt);
    if (b) b.llmCost += c.costUsd;
  }
  // A read = one learner × packet × day row, matching the "Reads" stat card.
  for (const d of days) {
    const b = at(d.day);
    if (b) b.reads += 1;
  }
  for (const j of jobs) {
    const b = j.finishedAt ? at(j.finishedAt) : undefined;
    if (b) b.packetsCreated += 1;
  }

  return [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Fixed all-time LLM figures shown above the date picker.
 *
 * The monthly average uses COMPLETE calendar months only: the current month is
 * excluded from both the sum and the divisor, so the number doesn't collapse
 * every 1st and recover by month end.
 */
async function llmOverview(): Promise<LlmOverview> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [all, firstCall, beforeThisMonth, published] = await Promise.all([
    db.llmCall.aggregate({ _sum: { costUsd: true } }),
    db.llmCall.aggregate({ _min: { createdAt: true } }),
    db.llmCall.aggregate({
      where: { createdAt: { lt: startOfMonth } },
      _sum: { costUsd: true },
    }),
    db.packet.findMany({ where: { status: "PUBLISHED" }, select: { lifetimeCostUsd: true } }),
  ]);

  const totalSinceInception = all._sum.costUsd ?? 0;
  const first = firstCall._min.createdAt;
  const completeMonths = first
    ? (now.getUTCFullYear() - first.getUTCFullYear()) * 12 + (now.getUTCMonth() - first.getUTCMonth())
    : 0;
  const avgPerMonth =
    completeMonths > 0 ? (beforeThisMonth._sum.costUsd ?? 0) / completeMonths : null;

  const publishedPackets = published.length;
  const publishedCost = published.reduce((n, p) => n + p.lifetimeCostUsd, 0);

  return {
    avgPerMonth,
    completeMonths,
    totalSinceInception,
    publishedPackets,
    costPerPublishedPacket: publishedPackets ? publishedCost / publishedPackets : null,
    costPerPublishedPacketInclWaste: publishedPackets
      ? totalSinceInception / publishedPackets
      : null,
  };
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

  const [days, feedbackRows, syncState, daily, overview] = await Promise.all([
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
    dailySeries(range),
    llmOverview(),
  ]);

  const created = byKey["packets-created"]?.rows ?? [];
  const readsRows = byKey["reads"]?.rows ?? [];
  const timeRows = byKey["time-spent"]?.rows ?? [];
  const consumption = byKey["learner-packet-consumption"];
  const logRows = consumption?.rows ?? [];

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
      const c = (h: string) => String(col(consumption, r, h) ?? "");
      return {
        email: c("Learner email"),
        company: c("Company"),
        role: c("Role"),
        track: c("Track"),
        firstRead: c("First read"),
        lastRead: c("Last read"),
        days: num(col(consumption, r, "Days read")),
        timeSpent: c("Time spent"),
        scrollPct: num(col(consumption, r, "Scroll %")),
        link: c("Packet link"),
      };
    }),
    daily,
    llmOverview: overview,
    lastReadsSyncAt: syncState?.lastReadsSyncAt?.toISOString() ?? null,
    lastFeedbackSyncAt: syncState?.lastFeedbackSyncAt?.toISOString() ?? null,
  };
}

export type TrackingData = TrackingSummary;
