import { Skeleton } from "@/components/ui/skeleton";
import { HeaderSkeleton, LoadingRegion, RowsSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading packets">
      <HeaderSkeleton action />
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-9 min-w-[200px] flex-1" />
        <Skeleton className="h-9 w-48" />
      </div>
      <RowsSkeleton rows={7} />
    </LoadingRegion>
  );
}
