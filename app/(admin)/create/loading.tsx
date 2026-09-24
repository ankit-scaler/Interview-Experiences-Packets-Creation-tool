import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, LoadingRegion } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl">
      <LoadingRegion label="Loading form">
        <HeaderSkeleton />
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9" />
            </div>
          ))}
          <Skeleton className="h-24" />
          <Skeleton className="h-10 w-40" />
        </div>
      </LoadingRegion>
    </div>
  );
}
