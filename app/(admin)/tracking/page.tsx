import { trackingSummary } from "@/lib/tracking";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { TrackingDashboard } from "@/components/tracking-dashboard";

export const dynamic = "force-dynamic";

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const [data, packets] = await Promise.all([
    trackingSummary(searchParams.from, searchParams.to),
    db.packet.findMany({ select: { company: true, role: true }, orderBy: { company: "asc" } }),
  ]);
  const pairs = [
    ...new Map(packets.map((p) => [`${p.company}||${p.role}`, p])).values(),
  ].map((p) => ({ company: p.company, role: p.role }));

  return <TrackingDashboard data={data} appUrl={env.appUrl} packetPairs={pairs} />;
}
