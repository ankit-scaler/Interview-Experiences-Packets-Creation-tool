import { cn } from "@/lib/utils";

/** Placeholder block shown while content loads. Size it with className. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton h-4 w-full", className)} {...props} />;
}
