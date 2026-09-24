import { Skeleton } from "@/components/ui/skeleton";
import { LoadingRegion } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <LoadingRegion label="Loading packet">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-72 max-w-full" />
          <Skeleton className="h-3 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
      {[0, 1].map((r) => (
        <section key={r} className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="divide-y divide-border">
            {[0, 1, 2].map((q) => (
              <div key={q} className="space-y-2 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-14" />
                <Skeleton className="h-8 w-2/3" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </LoadingRegion>
  );
}
