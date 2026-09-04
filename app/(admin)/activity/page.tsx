import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ActivityLog } from "@/components/activity-log";

export const dynamic = "force-dynamic";

/** How many entries a single page load pulls. */
const LIMIT = 500;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const to = searchParams.to ? new Date(`${searchParams.to}T23:59:59.999`) : new Date();
  const from = searchParams.from
    ? new Date(`${searchParams.from}T00:00:00`)
    : new Date(to.getTime() - 30 * 24 * 3600 * 1000);

  const entries = await db.adminActivity.findMany({
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });

  return (
    <ActivityLog
      appUrl={env.appUrl}
      limit={LIMIT}
      from={from.toISOString().slice(0, 10)}
      to={to.toISOString().slice(0, 10)}
      entries={entries.map((e) => ({
        id: e.id,
        actorEmail: e.actorEmail,
        action: e.action,
        packetLabel: e.packetLabel,
        packetSlug: e.packetSlug,
        detail: e.detail,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
