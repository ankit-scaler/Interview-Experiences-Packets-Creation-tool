"use client";

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { PREP_MAX, normalizePrep } from "@/lib/prep";
import { cn } from "@/lib/utils";

/** Admin editor for the learner-visible "Preparatory Kit" (pasted HackMD markdown). */
export function PrepEditor({ packetId, initial }: { packetId: string; initial: string | null }) {
  const [open, setOpen] = useState(Boolean(initial));
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(normalizePrep(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = normalizePrep(text);
  const dirty = current !== saved;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/packets/${packetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prepMaterial: current }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save the Preparatory Kit");
      }
      setSaved(current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the Preparatory Kit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <BookOpen className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold">Preparatory Kit</span>
        {saved ? (
          <Badge variant="success">Visible to learners</Badge>
        ) : (
          <Badge variant="outline">Hidden — empty</Badge>
        )}
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">
            Paste the markdown from HackMD (Edit mode → select all → copy). Shown to learners as the
            first item, above R1. Headings, lists, tables, checkboxes, links, images and code blocks
            render. Leave empty to hide it.
          </p>
          <div className="flex gap-1.5">
            {(["edit", "preview"] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? "secondary" : "ghost"}
                onClick={() => setTab(t)}
              >
                {t === "edit" ? "Edit" : "Preview"}
              </Button>
            ))}
          </div>
          {tab === "edit" ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              maxLength={PREP_MAX}
              placeholder={"# How to prepare\n\n- Revise [system design basics](https://example.com)\n- Practice 10 SQL joins"}
              className="font-mono text-sm"
            />
          ) : current ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border border-border p-3">
              <Markdown source={current} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" loading={saving} disabled={!dirty || saving} onClick={save}>
              Save Preparatory Kit
            </Button>
            {dirty && !saving && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          </div>
        </div>
      )}
    </section>
  );
}
