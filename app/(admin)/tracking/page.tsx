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
    db.packet.findMany({ select: { company: true, role: true } }),
  ]);
  const companies = [...new Set(packets.map((p) => p.company))].sort((a, b) =>
    a.localeCompare(b),
  );
  const roles = [...new Set(packets.map((p) => p.role))].sort((a, b) => a.localeCompare(b));

  return (
    <TrackingDashboard data={data} appUrl={env.appUrl} companies={companies} roles={roles} />
  );
}
