import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, LoadingRegion, RowsSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading activity">
      <HeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <RowsSkeleton rows={8} />
    </LoadingRegion>
  );
}
