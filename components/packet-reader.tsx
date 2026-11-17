"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, ExternalLink, Flag, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitTopic } from "@/lib/topic";
import { hashFor, parseReaderHash, type ReaderView } from "@/lib/prep";
import { ROUND_DONE_EVENT } from "@/components/read-tracker";
import { Markdown } from "@/components/markdown";
import { PrepTracker } from "@/components/prep-tracker";
import { Skeleton } from "@/components/ui/skeleton";

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

const RAIL_BTN =
  "flex h-10 min-w-[168px] shrink-0 items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-sm transition-colors md:min-w-0";
const RAIL_ON = "border-border bg-card font-semibold text-foreground elev";
const RAIL_OFF = "border-transparent text-muted-foreground hover:bg-subtle hover:text-foreground";

/**
 * One view at a time: an optional Preparatory Kit pinned above the rounds, then
 * the rounds. A rail (sidebar on desktop, tab row on phone) switches between
 * them; the active view lives in the URL hash (`#prep`, `#r2`) so refresh, back
 * and shared links keep it.
 */
export function PacketReader({
  rounds,
  prep,
  slug,
}: {
  rounds: ReaderRound[];
  prep: string | null;
  slug: string;
}) {
  const hasPrep = Boolean(prep);
  // With a kit the first view depends on the hash, so stay unresolved until the
  // effect below has read it — otherwise `#r2` links would briefly mount the kit
  // and log a false kit read.
  const [view, setView] = useState<ReaderView | null>(hasPrep ? null : 0);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prepRef = useRef<HTMLDivElement>(null);

  // Sync from the hash on load and on back / forward.
  useEffect(() => {
    const sync = () => setView(parseReaderHash(window.location.hash, rounds.length, hasPrep));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [rounds.length, hasPrep]);

  const goTo = useCallback((v: ReaderView) => {
    setView(v);
    setQuery("");
    window.history.pushState(null, "", hashFor(v));
    // Jump (not smooth-scroll) to the start if the learner has scrolled past it —
    // a smooth scroll would sweep the new round's end marker through the viewport
    // and count it as read.
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView({ block: "start" });
    }
  }, []);

  const activeIdx = typeof view === "number" ? view : -1;
  const round = activeIdx >= 0 ? rounds[activeIdx] : undefined;
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

  // From the kit (-1) "next" is the first round.
  const next = rounds[activeIdx + 1];
  const nextCard = next && (
    <div className="mt-5 flex justify-end">
      <button
        type="button"
        onClick={() => goTo(activeIdx + 1)}
        className="group w-full rounded-xl border border-border bg-card px-4 py-2.5 text-left transition-colors hover:bg-subtle sm:w-auto sm:min-w-[200px]"
      >
        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Next round
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[15px] font-semibold">
          {roundLabel(next, activeIdx + 1)}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-[3px]" />
        </span>
      </button>
    </div>
  );

  if (!hasPrep && !round) return null;

  return (
    <div ref={topRef} className="scroll-mt-20 md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-7">
      {/* Rail — horizontal tabs on phone, sticky sidebar on desktop. Stays visible in every view. */}
      <nav aria-label="Packet sections" className="md:sticky md:top-20 md:self-start">
        <p className="mb-1.5 hidden px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:block">
          Contents
        </p>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:pb-0">
          {hasPrep && (
            <button
              type="button"
              onClick={() => goTo("prep")}
              aria-current={view === "prep" ? "true" : undefined}
              className={cn(RAIL_BTN, view === "prep" ? RAIL_ON : RAIL_OFF)}
            >
              <span className="truncate">Preparatory Kit</span>
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
            </button>
          )}
          {rounds.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === view ? "true" : undefined}
              className={cn(RAIL_BTN, i === view ? RAIL_ON : RAIL_OFF)}
            >
              <span className="truncate">{roundLabel(r, i)}</span>
              <span className="rounded-md bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-primary">
                {r.questions.length}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {view === null ? (
        <section className="mt-5 min-w-0 space-y-3 md:mt-0" aria-busy>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : view === "prep" && prep ? (
        <section className="mt-5 min-w-0 md:mt-0">
          <h2 className="text-xl font-bold leading-tight tracking-tight">Preparatory Kit</h2>
          <div ref={prepRef} className="mt-4 max-w-[88ch]">
            <Markdown source={prep} />
          </div>
          <PrepTracker slug={slug} targetRef={prepRef} />
          {nextCard}
        </section>
      ) : round ? (
        <section className="mt-5 min-w-0 md:mt-0">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold leading-tight tracking-tight">{roundLabel(round, activeIdx)}</h2>
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

          {nextCard}
        </section>
      ) : null}
    </div>
  );
}
