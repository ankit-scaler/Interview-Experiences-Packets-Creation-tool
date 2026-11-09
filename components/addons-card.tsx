"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { addOnsNeedsToggle } from "@/lib/sections";
import { cn } from "@/lib/utils";

/** Learner view of the admin-written Add-Ons: short preview, expands on click. */
export function AddOnsCard({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  const toggle = addOnsNeedsToggle(markdown);
  const expanded = open || !toggle;

  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Sparkles className="h-4 w-4 text-accent" />
        Interview Companion Add-Ons
      </h2>
      <div
        className={cn(
          "relative mt-2 overflow-hidden",
          !expanded && "max-h-[4.5rem]",
        )}
      >
        <Markdown source={markdown} />
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>
      {toggle && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {open ? "Show less" : "Read more"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
