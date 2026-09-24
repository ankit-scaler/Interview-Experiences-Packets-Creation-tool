import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, LoadingRegion } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading tracking data">
      <HeaderSkeleton action />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-muted p-4">
          <Skeleton className="h-4 w-48" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border p-4 last:border-0">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-2 w-16" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
