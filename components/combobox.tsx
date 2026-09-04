"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const MAX_SHOWN = 10;

/**
 * Free-text input with a filtered suggestion dropdown. The user can always type a
 * value that isn't in the list.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  id,
  emptyHint,
  disabled,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
  emptyHint?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fallbackId = useId();

  const needle = value.trim().toLowerCase();

  // Rank: prefix matches first, then word-start, then anywhere.
  const { shown, total } = useMemo(() => {
    if (!needle) return { shown: options.slice(0, MAX_SHOWN), total: options.length };
    const scored: { o: string; s: number }[] = [];
    for (const o of options) {
      const l = o.toLowerCase();
      const i = l.indexOf(needle);
      if (i < 0) continue;
      scored.push({ o, s: i === 0 ? 0 : /\s/.test(l[i - 1] ?? "") ? 1 : 2 });
    }
    scored.sort((a, b) => a.s - b.s || a.o.length - b.o.length);
    return { shown: scored.slice(0, MAX_SHOWN).map((x) => x.o), total: scored.length };
  }, [options, needle]);

  const exact = options.some((o) => o.toLowerCase() === needle);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => setActive(0), [needle]);

  const showPanel = open && !disabled && (loading || shown.length > 0 || (needle && !exact && emptyHint));

  return (
    <div ref={wrapRef} className="relative">
      <Input
        id={id ?? fallbackId}
        value={value}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") return setOpen(false);
          if (!open || !shown.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && shown[active]) {
            e.preventDefault();
            onChange(shown[active]);
            setOpen(false);
          }
        }}
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {showPanel && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-card p-1 text-sm shadow-lg">
          {loading && (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">Loading suggestions…</li>
          )}
          {shown.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center rounded px-2 py-1.5 text-left",
                  i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
              >
                {o}
              </button>
            </li>
          ))}
          {total > shown.length && (
            <li className="px-2 py-1.5 text-[11px] text-muted-foreground">
              +{total - shown.length} more — keep typing to narrow
            </li>
          )}
          {!loading && needle && !exact && emptyHint && (
            <li className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
              {emptyHint}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
