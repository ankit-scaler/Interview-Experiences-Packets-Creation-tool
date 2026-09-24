import { Skeleton } from "@/components/ui/skeleton";

/** Wraps a loading skeleton so screen readers announce it once. */
export function LoadingRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Page title + subtitle, with an optional action button on the right. */
export function HeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  );
}

/** A bordered list of rows, e.g. packets or activity entries. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 p-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4" style={{ width: `${55 - (i % 3) * 10}%` }} />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0" />
        </li>
      ))}
    </ul>
  );
}
