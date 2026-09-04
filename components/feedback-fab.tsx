"use client";

import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { FeedbackForm } from "@/components/feedback-form";
import { cn } from "@/lib/utils";

type Matched = "YES" | "PARTLY" | "NO";

/** Always-present feedback button, bottom-right, opens the form in a panel. */
export function FeedbackFab({
  slug,
  initial,
}: {
  slug: string;
  initial: { stars: number; matched: Matched; comment: string } | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm origin-bottom-right transition-all",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
      >
        <div className="relative">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close feedback"
            className="absolute -right-2 -top-2 z-10 rounded-full border border-border bg-card p-1 shadow"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="shadow-xl">
            <FeedbackForm slug={slug} initial={initial} onSaved={() => setTimeout(() => setOpen(false), 1200)} />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "hidden",
        )}
      >
        <MessageSquare className="h-4 w-4" />
        {initial ? "Your feedback" : "Share feedback"}
      </button>
    </>
  );
}
