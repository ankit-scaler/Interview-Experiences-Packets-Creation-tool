/**
 * Date-range analytics used by both the admin Tracking dashboard, the per-card
 * CSV downloads, and the Google-Sheets mirror.
 */
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatDate, formatDateTime, formatDuration } from "@/lib/utils";
import { NOT_INTERNAL, NOT_INTERNAL_VIA_READ } from "@/lib/internal";

export interface DateRange {
  /** Inclusive start / end as timestamps (local calendar day → instant). */
  from: Date;
  to: Date;
  /** Same window as UTC-midnight dates, for `@db.Date` columns (Prisma truncates
   *  a timestamp filter on a Date column to its date part, losing the time). */
  fromDay: Date;
  toDay: Date;
}

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export interface Report {
  key: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

function packetUrl(slug: string) {
  return `${env.appUrl.replace(/\/$/, "")}/p/${slug}`;
}

/** Days covered by the dashboard's default window (the "7D" preset). */
export const DEFAULT_RANGE_DAYS = 7;

export function parseRange(fromStr?: string | null, toStr?: string | null): DateRange {
  const to = toStr ? new Date(`${toStr}T23:59:59.999`) : new Date();
  const from = fromStr
    ? new Date(`${fromStr}T00:00:00`)
    : // Inclusive of today, so "7D" spans today and the 6 days before it.
      new Date(to.getTime() - (DEFAULT_RANGE_DAYS - 1) * 24 * 3600 * 1000);
  return { from, to, fromDay: utcMidnight(from), toDay: utcMidnight(to) };
}

// --- individual reports ----------------------------------------------------

/** Every generation that landed in range — new packets and appends alike. */
async function packetsCreated({ from, to }: DateRange): Promise<Report> {
  const jobs = await db.generationJob.findMany({
    where: { status: "SUCCEEDED", finishedAt: { gte: from, lte: to } },
    include: { packet: { select: { company: true, role: true, track: true, slug: true, createdAt: true } } },
    orderBy: { finishedAt: "desc" },
  });
  return {
    key: "packets-created",
    title: "Packets created / updated",
    headers: ["Finished At", "Type", "Company", "Role", "Track", "Questions added", "LLM cost", "Packet link"],
    rows: jobs.map((j) => {
      const stats = (j.stats as { added?: number } | null) ?? {};
      const isNew =
        j.kind === "INITIAL" ||
        (j.packet.createdAt && j.finishedAt && j.finishedAt.getTime() - j.packet.createdAt.getTime() < 5 * 60_000);
      return [
        formatDateTime(j.finishedAt),
        isNew ? "New" : "Append",
        j.packet.company,
        j.packet.role,
        j.packet.track,
        stats.added ?? 0,
        `$${j.costUsd.toFixed(4)}`,
        packetUrl(j.packet.slug),
      ];
    }),
  };
}

/** Reads per packet within the range (a read = a distinct learner-day). */
async function readsByPacket({ fromDay, toDay }: DateRange): Promise<Report> {
  const days = await db.packetReadDay.findMany({
    where: { day: { gte: fromDay, lte: toDay }, NOT: NOT_INTERNAL_VIA_READ },
    include: { packetRead: { include: { packet: { select: { company: true, role: true, track: true, slug: true } } } } },
  });
  const byPacket = new Map<string, { company: string; role: string; track: string; slug: string; reads: number; learners: Set<string>; seconds: number }>();
  for (const d of days) {
    const p = d.packetRead.packet;
    const k = p.slug;
    const e = byPacket.get(k) ?? { company: p.company, role: p.role, track: p.track, slug: p.slug, reads: 0, learners: new Set(), seconds: 0 };
    e.reads += 1;
    e.learners.add(d.packetRead.userEmail);
    e.seconds += d.seconds;
    byPacket.set(k, e);
  }
  return {
    key: "reads",
    title: "Reads by packet",
    headers: ["Company", "Role", "Track", "Reads", "Unique learners", "Total time", "Packet link"],
    rows: [...byPacket.values()]
      .sort((a, b) => b.reads - a.reads)
      .map((e) => [e.company, e.role, e.track, e.reads, e.learners.size, formatDuration(e.seconds), packetUrl(e.slug)]),
  };
}

/** Published packets that got zero reads in the range. */
async function packetsNoReads({ to, fromDay, toDay }: DateRange): Promise<Report> {
  const packets = await db.packet.findMany({
    where: { status: "PUBLISHED", publishedAt: { lte: to } },
    select: { company: true, role: true, track: true, slug: true, publishedAt: true },
  });
  const readSlugs = new Set(
    (
      await db.packetReadDay.findMany({
        where: { day: { gte: fromDay, lte: toDay }, NOT: NOT_INTERNAL_VIA_READ },
        select: { packetRead: { select: { packet: { select: { slug: true } } } } },
      })
    ).map((d) => d.packetRead.packet.slug),
  );
  return {
    key: "no-reads",
    title: "Published packets with no reads",
    headers: ["Company", "Role", "Track", "Published", "Packet link"],
    rows: packets
      .filter((p) => !readSlugs.has(p.slug))
      .map((p) => [p.company, p.role, p.track, formatDate(p.publishedAt), packetUrl(p.slug)]),
  };
}

/**
 * LLM spend per packet within the range, plus all-time consumption efficiency.
 *
 * The token/cost columns are scoped to the picked range; the trailing columns
 * are deliberately all-time (lifetime packet spend against every read it has
 * ever had), because a cost-per-read ratio built from a 7-day window would
 * divide this week's reads by a packet generated last month. Headers say which
 * is which.
 */
async function llmCostByPacket({ from, to }: DateRange): Promise<Report> {
  const calls = await db.llmCall.findMany({
    where: { createdAt: { gte: from, lte: to }, packetId: { not: null } },
    include: { packet: { select: { company: true, role: true, slug: true } } },
  });
  const byPacket = new Map<string, { company: string; role: string; slug: string; cost: number; inTok: number; outTok: number; cachedTok: number }>();
  for (const c of calls) {
    if (!c.packet) continue;
    const e = byPacket.get(c.packet.slug) ?? { company: c.packet.company, role: c.packet.role, slug: c.packet.slug, cost: 0, inTok: 0, outTok: 0, cachedTok: 0 };
    e.cost += c.costUsd;
    e.inTok += c.inputTokens;
    e.outTok += c.outputTokens;
    e.cachedTok += c.cachedInputTokens;
    byPacket.set(c.packet.slug, e);
  }

  // All-time lifetime spend + reads for every packet that appears above.
  const packets = await db.packet.findMany({
    where: { slug: { in: [...byPacket.keys()] } },
    select: {
      slug: true,
      lifetimeCostUsd: true,
      reads: { where: { NOT: NOT_INTERNAL }, select: { userEmail: true, readDays: true } },
    },
  });
  const lifetime = new Map(
    packets.map((p) => [
      p.slug,
      {
        cost: p.lifetimeCostUsd,
        reads: p.reads.reduce((n, r) => n + r.readDays, 0),
        learners: new Set(p.reads.map((r) => r.userEmail.toLowerCase())).size,
      },
    ]),
  );
  const per = (cost: number, n: number) => (n > 0 ? `$${(cost / n).toFixed(4)}` : "—");

  return {
    key: "llm-cost",
    title: "LLM cost by packet",
    headers: [
      "Company",
      "Role",
      "Input tokens",
      "Cached input",
      "Output tokens",
      "Cost (USD)",
      "Lifetime cost (all-time)",
      "Reads (all-time)",
      "Unique learners (all-time)",
      "Cost / read (all-time)",
      "Cost / learner (all-time)",
      "Packet link",
    ],
    rows: [...byPacket.values()]
      .sort((a, b) => b.cost - a.cost)
      .map((e) => {
        const lt = lifetime.get(e.slug) ?? { cost: 0, reads: 0, learners: 0 };
        return [
          e.company,
          e.role,
          e.inTok,
          e.cachedTok,
          e.outTok,
          `$${e.cost.toFixed(4)}`,
          `$${lt.cost.toFixed(4)}`,
          lt.reads,
          lt.learners,
          per(lt.cost, lt.reads),
          per(lt.cost, lt.learners),
          packetUrl(e.slug),
        ];
      }),
  };
}

/** Time each learner spent on each packet within the range. */
async function timeSpentByLearnerPacket({ fromDay, toDay }: DateRange): Promise<Report> {
  const days = await db.packetReadDay.findMany({
    where: { day: { gte: fromDay, lte: toDay }, seconds: { gt: 0 }, NOT: NOT_INTERNAL_VIA_READ },
    include: { packetRead: { include: { packet: { select: { company: true, role: true, slug: true } } } } },
  });
  const byPair = new Map<string, { email: string; company: string; role: string; slug: string; seconds: number; days: number }>();
  for (const d of days) {
    const p = d.packetRead.packet;
    const k = `${d.packetRead.userEmail}::${p.slug}`;
    const e = byPair.get(k) ?? { email: d.packetRead.userEmail, company: p.company, role: p.role, slug: p.slug, seconds: 0, days: 0 };
    e.seconds += d.seconds;
    e.days += 1;
    byPair.set(k, e);
  }
  return {
    key: "time-spent",
    title: "Avg time spent per packet by learner",
    headers: ["Learner email", "Company", "Role", "Days read", "Time spent", "Packet link"],
    rows: [...byPair.values()]
      .sort((a, b) => b.seconds - a.seconds)
      .map((e) => [e.email, e.company, e.role, e.days, formatDuration(e.seconds), packetUrl(e.slug)]),
  };
}

/** Learners who read the same packet on 2+ distinct days in a calendar month. */
async function repeatReaders({ fromDay, toDay }: DateRange): Promise<Report> {
  const days = await db.packetReadDay.findMany({
    where: { day: { gte: fromDay, lte: toDay }, NOT: NOT_INTERNAL_VIA_READ },
    include: { packetRead: { include: { packet: { select: { company: true, role: true, slug: true } } } } },
  });
  const counts = new Map<string, { email: string; company: string; role: string; slug: string; month: string; days: number }>();
  for (const d of days) {
    const p = d.packetRead.packet;
    const month = `${d.day.getUTCFullYear()}-${String(d.day.getUTCMonth() + 1).padStart(2, "0")}`;
    const k = `${d.packetRead.userEmail}::${p.slug}::${month}`;
    const e = counts.get(k) ?? { email: d.packetRead.userEmail, company: p.company, role: p.role, slug: p.slug, month, days: 0 };
    e.days += 1;
    counts.set(k, e);
  }
  return {
    key: "repeat-reads",
    title: "Repeat reads (same packet 2+ days / month)",
    headers: ["Learner email", "Company", "Role", "Month", "Days read", "Packet link"],
    rows: [...counts.values()]
      .filter((e) => e.days >= 2)
      .sort((a, b) => b.days - a.days)
      .map((e) => [e.email, e.company, e.role, e.month, e.days, packetUrl(e.slug)]),
  };
}

async function feedbackReport({ from, to }: DateRange): Promise<Report> {
  const fb = await db.feedback.findMany({
    where: { createdAt: { gte: from, lte: to }, NOT: NOT_INTERNAL },
    include: { packet: { select: { company: true, role: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
  return {
    key: "feedback",
    title: "Feedback",
    headers: ["Submitted At", "Company", "Role", "Learner email", "Stars", "Matched interview", "Comment", "Packet link"],
    rows: fb.map((f) => [
      formatDateTime(f.createdAt),
      f.packet.company,
      f.packet.role,
      f.userEmail,
      f.stars,
      f.matched,
      f.comment ?? "",
      packetUrl(f.packet.slug),
    ]),
  };
}

async function vaultClicks({ from, to }: DateRange): Promise<Report> {
  const clicks = await db.vaultClick.findMany({
    where: { createdAt: { gte: from, lte: to }, NOT: NOT_INTERNAL },
    include: { packet: { select: { company: true, role: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
  return {
    key: "vault-clicks",
    title: "Vault clicks",
    headers: ["Clicked At", "Learner email", "From packet", "Packet link"],
    rows: clicks.map((c) => [
      formatDateTime(c.createdAt),
      c.userEmail,
      c.packet ? `${c.packet.company} — ${c.packet.role}` : "—",
      c.packet ? packetUrl(c.packet.slug) : "",
    ]),
  };
}

/** One row per learner × packet — the single "who read what" view. */
async function learnerPacketConsumption({ from, to }: DateRange): Promise<Report> {
  const reads = await db.packetRead.findMany({
    where: {
      OR: [{ firstReadAt: { gte: from, lte: to } }, { lastReadAt: { gte: from, lte: to } }],
      NOT: NOT_INTERNAL,
    },
    include: {
      packet: { select: { company: true, role: true, slug: true, track: true } },
      days: { select: { seconds: true } },
    },
    orderBy: { lastReadAt: "desc" },
  });
  return {
    key: "learner-packet-consumption",
    title: "Learner × Packet Consumption",
    headers: [
      "Learner email",
      "Company",
      "Role",
      "Track",
      "First read",
      "Last read",
      "Days read",
      "Time spent",
      "Scroll %",
      "Packet link",
    ],
    rows: reads.map((r) => [
      r.userEmail,
      r.packet.company,
      r.packet.role,
      r.packet.track,
      formatDate(r.firstReadAt),
      formatDate(r.lastReadAt),
      r.readDays,
      formatDuration(r.days.reduce((n, d) => n + d.seconds, 0)),
      `${r.scrollPct}%`,
      packetUrl(r.packet.slug),
    ]),
  };
}

export interface RosterFilters {
  company?: string | null;
  role?: string | null;
}

/**
 * One row per packet, filterable by company / role and a last-created-or-edited
 * window — the "which packets exist and who has read them" directory. Reads are
 * all-time and exclude internal (@scaler.com) accounts.
 */
export async function packetRoster(
  { from, to }: DateRange,
  filters: RosterFilters = {},
): Promise<Report> {
  const company = filters.company?.trim();
  const role = filters.role?.trim();
  const packets = await db.packet.findMany({
    where: {
      updatedAt: { gte: from, lte: to },
      ...(company ? { company: { contains: company, mode: "insensitive" } } : {}),
      ...(role ? { role: { contains: role, mode: "insensitive" } } : {}),
    },
    select: {
      company: true,
      role: true,
      track: true,
      status: true,
      slug: true,
      updatedAt: true,
      reads: { where: { NOT: NOT_INTERNAL }, select: { userEmail: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return {
    key: "packet-roster",
    title: "Packet directory",
    headers: [
      "Company",
      "Role",
      "Track",
      "Status",
      "Last created / edited",
      "Unique reads",
      "Reader emails",
      "Packet link",
    ],
    rows: packets.map((p) => {
      const emails = [...new Set(p.reads.map((r) => r.userEmail.toLowerCase()))].sort();
      return [
        p.company,
        p.role,
        p.track,
        p.status,
        formatDate(p.updatedAt),
        emails.length,
        emails.join(", "),
        packetUrl(p.slug),
      ];
    }),
  };
}

export const REPORTS: Record<string, (r: DateRange) => Promise<Report>> = {
  "packets-created": packetsCreated,
  reads: readsByPacket,
  "learner-packet-consumption": learnerPacketConsumption,
  "no-reads": packetsNoReads,
  "llm-cost": llmCostByPacket,
  // Not mirrored to Sheets (see TAB_FOR) — kept for the dashboard stat cards
  // and their CSV downloads.
  "time-spent": timeSpentByLearnerPacket,
  "repeat-reads": repeatReaders,
  feedback: feedbackReport,
  "vault-clicks": vaultClicks,
  "packet-roster": (r) => packetRoster(r),
};

export async function buildReport(key: string, range: DateRange): Promise<Report | null> {
  const fn = REPORTS[key];
  return fn ? fn(range) : null;
}

/** Run in small batches — a burst of parallel queries can trip a cold Neon compute. */
export async function buildAllReports(range: DateRange): Promise<Report[]> {
  const fns = Object.values(REPORTS);
  const out: Report[] = [];
  for (let i = 0; i < fns.length; i += 3) {
    // eslint-disable-next-line no-await-in-loop
    out.push(...(await Promise.all(fns.slice(i, i + 3).map((fn) => fn(range)))));
  }
  return out;
}
