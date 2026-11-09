"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ExternalLink, Flag, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitTopic } from "@/lib/topic";
import { ROUND_DONE_EVENT } from "@/components/read-tracker";

export interface ReaderRound {
  id: string;
  name: string;
  duration: string | null;
  isSpillover: boolean;
  questions: { id: string; displayText: string; problemLink: string | null }[];
}

/** "R1 · Online Assessment"; the spillover round keeps its own name. */
function roundLabel(r: ReaderRound, i: number) {
  return r.isSpillover ? r.name : `R${i + 1} · ${r.name}`;
}

/** `#r2` → 1 (0-based), clamped; anything else → 0. */
function indexFromHash(count: number): number {
  const m = window.location.hash.match(/^#r(\d+)$/);
  const n = m ? Number(m[1]) - 1 : 0;
  return n >= 0 && n < count ? n : 0;
}

/**
 * One round at a time: a rounds rail (sidebar on desktop, tab row on phone),
 * search within the round, copy per question, and a "Next round" link. The
 * active round lives in the URL hash so refresh / back keep it.
 */
export function PacketReader({ rounds }: { rounds: ReaderRound[] }) {
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Sync from the hash on load and on back / forward.
  useEffect(() => {
    const sync = () => setActive(indexFromHash(rounds.length));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [rounds.length]);

  const goTo = useCallback((i: number) => {
    setActive(i);
    setQuery("");
    window.history.pushState(null, "", `#r${i + 1}`);
    // Jump (not smooth-scroll) to the round's start if the learner has scrolled
    // past it — a smooth scroll would sweep the new round's end marker through
    // the viewport and count it as read.
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView({ block: "start" });
    }
  }, []);

  const round = rounds[active];
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (round && q ? round.questions.filter((x) => x.displayText.toLowerCase().includes(q)) : round?.questions ?? []),
    [round, q],
  );

  // A round counts as read once its end comes into view with nothing filtered out.
  useEffect(() => {
    const el = endRef.current;
    if (!el || !round || q) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        window.dispatchEvent(new CustomEvent(ROUND_DONE_EVENT, { detail: round.id }));
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [round, q]);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard blocked — nothing useful to show */
    }
  };

  if (!round) return null;
  const next = rounds[active + 1];

  return (
    <div ref={topRef} className="scroll-mt-20 md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-7">
      {/* Rounds rail — horizontal tabs on phone, sticky sidebar on desktop. */}
      <nav aria-label="Rounds" className="md:sticky md:top-20 md:self-start">
        <p className="mb-1.5 hidden px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:block">
          Rounds
        </p>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:pb-0">
          {rounds.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === active ? "true" : undefined}
              className={cn(
                "flex h-10 min-w-[168px] shrink-0 items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-sm transition-colors md:min-w-0",
                i === active
                  ? "border-border bg-card font-semibold text-foreground elev"
                  : "border-transparent text-muted-foreground hover:bg-subtle hover:text-foreground",
              )}
            >
              <span className="truncate">{roundLabel(r, i)}</span>
              <span className="rounded-md bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-primary">
                {r.questions.length}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <section className="mt-5 min-w-0 md:mt-0">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight tracking-tight">{roundLabel(round, active)}</h2>
            {round.duration && <p className="mt-0.5 text-sm text-muted-foreground">{round.duration}</p>}
          </div>
          <label className="relative block sm:w-[200px]">
            <span className="sr-only">Search questions in this round</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions"
              className="h-[31px] w-full rounded-md border border-border bg-card pl-8 pr-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>

        <ol className="mt-4 space-y-2">
          {visible.map((x) => {
            const n = round.questions.indexOf(x) + 1;
            const { topic, body } = splitTopic(x.displayText);
            return (
              <li key={x.id} className="flex gap-3 rounded-xl border border-border bg-card px-3.5 py-3.5 sm:gap-3 sm:px-4">
                <span className="w-7 shrink-0 select-none pt-[3px] font-mono text-[13px] tabular-nums text-muted-foreground">
                  {String(n).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  {topic && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                      <Flag className="h-3 w-3" />
                      {topic}
                    </span>
                  )}
                  <p className="text-pretty text-[15px] font-medium leading-6 sm:text-base">{body}</p>
                  {x.problemLink && (
                    <a
                      href={x.problemLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-accent/25 bg-accent/5 px-2 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Solve this question
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => copy(x.id, body)}
                  aria-live="polite"
                  className="h-fit shrink-0 rounded px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copied === x.id ? "Copied" : "Copy"}
                </button>
              </li>
            );
          })}
          {!visible.length && (
            <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No questions in this round match “{query.trim()}”.
            </li>
          )}
        </ol>

        {/* End-of-round marker for reading progress. */}
        <div ref={endRef} aria-hidden className="h-px" />

        {next && (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              className="group w-full rounded-xl border border-border bg-card px-4 py-2.5 text-left transition-colors hover:bg-subtle sm:w-auto sm:min-w-[200px]"
            >
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Next round
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold">
                {roundLabel(next, active + 1)}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-[3px]" />
              </span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
