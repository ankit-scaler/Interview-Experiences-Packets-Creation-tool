import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the reader layout: header, vault card, rounds rail, question cards. */
export default function Loading() {
  return (
    <div className="learner flex min-h-screen flex-col bg-background" role="status" aria-live="polite">
      <span className="sr-only">Loading your interview packet</span>
      <div className="border-b border-border">
        <div className="flex h-[55px] items-center px-4 sm:px-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="ml-auto h-[30px] w-[90px]" />
        </div>
      </div>
      <div className="px-4">
        <div className="mx-auto max-w-[1040px] pb-12 pt-5 sm:pt-7">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-9 w-3/4" />
          <Skeleton className="mt-3 h-4 w-60" />
          <Skeleton className="mt-6 h-[100px] w-full rounded-2xl" />
          <div className="mt-6 md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-7">
            <div className="flex gap-1.5 md:flex-col md:gap-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 min-w-[168px] md:min-w-0" />
              ))}
            </div>
            <div className="mt-5 space-y-2 md:mt-0">
              <Skeleton className="mb-4 h-6 w-48" />
              {[0, 1, 2, 3].map((q) => (
                <div key={q} className="space-y-2 rounded-xl border border-border bg-card px-4 py-4">
                  <Skeleton className="h-4" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
