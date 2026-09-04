import { trackingSummary } from "@/lib/tracking";
import { env } from "@/lib/env";
import { TrackingDashboard } from "@/components/tracking-dashboard";

export const dynamic = "force-dynamic";

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const data = await trackingSummary(searchParams.from, searchParams.to);
  return <TrackingDashboard data={data} appUrl={env.appUrl} />;
}
