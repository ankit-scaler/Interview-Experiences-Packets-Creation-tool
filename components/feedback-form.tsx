"use client";

import { useState } from "react";
import { Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Matched = "YES" | "PARTLY" | "NO";

const MATCH_OPTIONS: { value: Matched; label: string }[] = [
  { value: "YES", label: "Yes" },
  { value: "PARTLY", label: "Partly" },
  { value: "NO", label: "No" },
];

export function FeedbackForm({
  slug,
  initial,
  onSaved,
}: {
  slug: string;
  initial: { stars: number; matched: Matched; comment: string } | null;
  onSaved?: () => void;
}) {
  const [stars, setStars] = useState(initial?.stars ?? 0);
  const [hover, setHover] = useState(0);
  const [matched, setMatched] = useState<Matched | null>(initial?.matched ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!stars || !matched) {
      setError("Please give a star rating and answer whether it matched your interview.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/p/${slug}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, matched, comment: comment || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not save feedback");
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">Share feedback</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        How helpful was this packet? Your response helps us improve it.
      </p>

      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setStars(n)}
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                (hover || stars) >= n
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">
          Did the questions match your interview?
        </p>
        <div className="mt-1.5 flex gap-2">
          {MATCH_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setMatched(o.value)}
              className={cn(
                "rounded-md border px-3 py-1 text-sm transition-colors",
                matched === o.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Anything else? (optional)"
        className="mt-4"
      />

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <Button className="mt-3" size="sm" onClick={submit} disabled={busy}>
        {saved ? <Check className="h-4 w-4" /> : null}
        {saved ? "Saved — thank you" : initial ? "Update feedback" : "Submit feedback"}
      </Button>
    </div>
  );
}
