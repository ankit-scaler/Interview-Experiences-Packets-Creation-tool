import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col" role="status" aria-live="polite">
      <span className="sr-only">Loading your interview packet</span>
      <div className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="ml-auto h-9 w-9" />
        </div>
      </div>
      <div className="px-4">
        <div className="mx-auto max-w-3xl py-6 sm:py-10">
          <div className="overflow-hidden rounded-2xl border border-border bg-card elev">
            <div className="space-y-2 border-b border-border px-6 py-6 sm:px-8 sm:py-8">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            {[0, 1].map((r) => (
              <div key={r} className="space-y-4 border-b border-border px-6 py-6 last:border-0 sm:px-8 sm:py-8">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-5 w-48" />
                </div>
                {[0, 1, 2].map((q) => (
                  <div key={q} className="space-y-2 pl-8">
                    <Skeleton className="h-4" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
