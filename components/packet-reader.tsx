"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, ExternalLink, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitTopic } from "@/lib/topic";
import {
  PREP_PROGRESS_EVENT,
  hashFor,
  parseReaderHash,
  prepSeenKey,
  type ReaderView,
} from "@/lib/prep";
import { ROUND_DONE_EVENT, loadDone } from "@/components/read-tracker";
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

interface OutlineItem {
  id: string;
  text: string;
  level: number;
}

/** "R1 · Online Assessment"; the spillover round keeps its own name. */
function roundLabel(r: ReaderRound, i: number) {
  return r.isSpillover ? r.name : `R${i + 1} · ${r.name}`;
}

const TAB =
  "flex w-full min-w-[168px] shrink-0 items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-sm font-semibold transition-colors md:min-w-0 md:border-transparent";
const TAB_ON = "border-border bg-accent/10 text-foreground md:border-transparent";
const TAB_OFF = "border-border text-muted-foreground hover:bg-accent/10 hover:text-foreground md:border-transparent";

/** Progress ring: filled arc = percent complete. */
function Ring({ pct }: { pct: number }) {
  return (
    <span
      aria-hidden
      className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(hsl(var(--accent)) ${Math.max(0, Math.min(100, pct))}%, hsl(var(--border)) 0)`,
      }}
    >
      <span className="h-3.5 w-3.5 rounded-full bg-card" />
    </span>
  );
}

/**
 * Three panes: sections rail | content | context panel (kit outline, or topic
 * filters / round info). One view at a time; the active view lives in the URL
 * hash (`#prep`, `#addons`, `#r2`) so refresh, back and shared links keep it.
 */
export function PacketReader({
  rounds,
  prep,
  addOns,
  slug,
  footer,
}: {
  rounds: ReaderRound[];
  prep: string | null;
  addOns: string | null;
  slug: string;
  footer?: ReactNode;
}) {
  const hasPrep = Boolean(prep);
  const hasAddOns = Boolean(addOns);
  // With a kit the first view depends on the hash, so stay unresolved until the
  // effect below has read it — otherwise `#r2` links would briefly mount the kit
  // and log a false kit read.
  const [view, setView] = useState<ReaderView | null>(hasPrep ? null : 0);
  const [query, setQuery] = useState("");
  const [hiddenTopics, setHiddenTopics] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [prepPct, setPrepPct] = useState(0);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const prepRef = useRef<HTMLDivElement>(null);

  // Sync from the hash on load and on back / forward.
  useEffect(() => {
    const sync = () =>
      setView(parseReaderHash(window.location.hash, rounds.length, hasPrep, hasAddOns));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [rounds.length, hasPrep, hasAddOns]);

  // Progress rings: rounds finished and kit depth, as remembered in this browser.
  useEffect(() => {
    setDone(loadDone(slug));
    try {
      setPrepPct(Number(window.localStorage.getItem(prepSeenKey(slug)) || 0));
    } catch {
      /* storage unavailable */
    }
    const onRound = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) setDone((d) => new Set(d).add(id));
    };
    const onPrep = (e: Event) => setPrepPct((p) => Math.max(p, Number((e as CustomEvent<number>).detail) || 0));
    window.addEventListener(ROUND_DONE_EVENT, onRound);
    window.addEventListener(PREP_PROGRESS_EVENT, onPrep);
    return () => {
      window.removeEventListener(ROUND_DONE_EVENT, onRound);
      window.removeEventListener(PREP_PROGRESS_EVENT, onPrep);
    };
  }, [slug]);

  const goTo = useCallback((v: ReaderView) => {
    setView(v);
    setQuery("");
    setHiddenTopics(new Set());
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
  const filtering = Boolean(q) || hiddenTopics.size > 0;

  const topics = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of round?.questions ?? []) {
      const { topic } = splitTopic(x.displayText);
      if (topic) m.set(topic, (m.get(topic) ?? 0) + 1);
    }
    return [...m.entries()];
  }, [round]);

  const visible = useMemo(
    () =>
      (round?.questions ?? []).filter((x) => {
        if (q && !x.displayText.toLowerCase().includes(q)) return false;
        const { topic } = splitTopic(x.displayText);
        return !(topic && hiddenTopics.has(topic));
      }),
    [round, q, hiddenTopics],
  );

  // A round counts as read once its end comes into view with nothing filtered out.
  useEffect(() => {
    const el = endRef.current;
    if (!el || !round || filtering) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        window.dispatchEvent(new CustomEvent(ROUND_DONE_EVENT, { detail: round.id }));
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [round, filtering]);

  // Kit outline: read the rendered headings, and highlight the one being read.
  useEffect(() => {
    if (view !== "prep") return;
    const heads = [...(prepRef.current?.querySelectorAll<HTMLElement>("[data-h]") ?? [])];
    setOutline(heads.map((h) => ({ id: h.id, text: h.textContent ?? "", level: Number(h.dataset.h) })));
    if (!heads.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActiveHeading(hit.target.id);
      },
      { rootMargin: "-72px 0px -70% 0px" },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [view, prep]);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard blocked — nothing useful to show */
    }
  };

  // From the kit / Add-Ons (-1) "next" is the first round.
  const next = rounds[activeIdx + 1];
  const nextCard = next && (
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        onClick={() => goTo(activeIdx + 1)}
        className="group w-full rounded-lg border border-border bg-card px-4 py-2.5 text-left transition-colors hover:bg-accent/10 sm:w-auto sm:min-w-[220px]"
      >
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Next</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[15px] font-bold">
          {roundLabel(next, activeIdx + 1)}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-[3px]" />
        </span>
      </button>
    </div>
  );

  if (!hasPrep && !hasAddOns && !round) return null;

  return (
    <div
      ref={topRef}
      className="scroll-mt-20 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 lg:grid-cols-[240px_minmax(0,1fr)_220px]"
    >
      {/* Rail — horizontal tabs on phone, sticky sidebar from md. Stays visible in every view. */}
      <nav aria-label="Packet sections" className="md:sticky md:top-20 md:self-start">
        <p className="mb-2 hidden px-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground md:block">
          Sections
        </p>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:pb-0">
          {hasPrep && (
            <button
              type="button"
              onClick={() => goTo("prep")}
              aria-current={view === "prep" ? "true" : undefined}
              className={cn(TAB, view === "prep" ? TAB_ON : TAB_OFF)}
            >
              <Ring pct={prepPct} />
              <span className="min-w-0 flex-1 truncate">Preparatory Kit</span>
            </button>
          )}
          {hasAddOns && (
            <button
              type="button"
              onClick={() => goTo("addons")}
              aria-current={view === "addons" ? "true" : undefined}
              className={cn(TAB, view === "addons" ? TAB_ON : TAB_OFF)}
            >
              <Sparkles className="h-[22px] w-[22px] shrink-0 p-[3px] text-accent" aria-hidden />
              <span className="min-w-0 flex-1 truncate">Add-Ons</span>
            </button>
          )}
          {rounds.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === view ? "true" : undefined}
              className={cn(TAB, i === view ? TAB_ON : TAB_OFF)}
            >
              <Ring pct={done.has(r.id) ? 100 : 0} />
              <span className="min-w-0 flex-1 truncate" title={roundLabel(r, i)}>{roundLabel(r, i)}</span>
              <span className="font-mono text-xs tabular-nums">{r.questions.length}</span>
            </button>
          ))}
        </div>
        {footer && <div className="mt-5 hidden md:block">{footer}</div>}
      </nav>

      <div className="min-w-0">
        {view === null ? (
          <section className="mt-5 space-y-3 md:mt-0" aria-busy>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-64 w-full" />
          </section>
        ) : view === "prep" && prep ? (
          <section className="mt-5 max-w-[760px] md:mt-0">
            <h2 className="text-[26px] font-extrabold leading-tight tracking-tight">Preparatory Kit</h2>
            <div ref={prepRef} className="mt-4">
              <Markdown source={prep} large />
            </div>
            <PrepTracker slug={slug} targetRef={prepRef} />
            {nextCard}
          </section>
        ) : view === "addons" && addOns ? (
          <section className="mt-5 max-w-[760px] md:mt-0">
            <h2 className="text-[26px] font-extrabold leading-tight tracking-tight">Interview Companion Add-Ons</h2>
            <div className="mt-4">
              <Markdown source={addOns} large />
            </div>
            {nextCard}
          </section>
        ) : round ? (
          <section className="mt-5 max-w-[760px] md:mt-0">
            <h2 className="text-[26px] font-extrabold leading-tight tracking-tight">{roundLabel(round, activeIdx)}</h2>
            <p className="mb-5 mt-1 text-[13px] text-muted-foreground">
              {round.questions.length} {round.questions.length === 1 ? "question" : "questions"}
              {round.duration ? ` · ${round.duration}` : ""}
            </p>
            <label className="relative block">
              <span className="sr-only">Search questions in this round</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions"
                className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <ol className="mt-3.5 overflow-hidden rounded-[10px] border border-border bg-card">
              {visible.map((x) => {
                const n = round.questions.indexOf(x) + 1;
                const { topic, body } = splitTopic(x.displayText);
                return (
                  <li key={x.id} className="grid grid-cols-[40px_minmax(0,1fr)] items-start border-t border-border py-3.5 pr-3 first:border-t-0 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:pr-4">
                    <span className="select-none pt-1 text-center font-mono text-xs tabular-nums text-muted-foreground">
                      {String(n).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      {topic && (
                        <span className="mb-1 inline-block rounded bg-accent/10 px-1.5 py-px font-mono text-[11px] font-medium text-accent">
                          {topic}
                        </span>
                      )}
                      <p className="text-pretty text-base font-medium leading-relaxed sm:text-[16.5px]">{body}</p>
                      {x.problemLink && (
                        <a
                          href={x.problemLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      className="col-start-2 mt-1 h-fit justify-self-start rounded px-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-start-3 sm:mt-0 sm:justify-self-auto"
                    >
                      {copied === x.id ? "Copied" : "Copy"}
                    </button>
                  </li>
                );
              })}
              {!visible.length && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No questions match your search and topic filters.
                </li>
              )}
            </ol>

            {/* End-of-round marker for reading progress. */}
            <div ref={endRef} aria-hidden className="h-px" />
            {nextCard}
          </section>
        ) : null}
        {footer && <div className="mt-8 md:hidden">{footer}</div>}
      </div>

      {/* Context panel — outline for the kit, topic filters / round info for a round. */}
      <aside aria-label="Context" className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        {view === "prep" && outline.length > 0 && (
          <>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">On this page</p>
            <ul>
              {outline.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => document.getElementById(o.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className={cn(
                      "block w-full border-l-2 py-1 pr-1 text-left text-[13.5px] font-medium transition-colors hover:text-foreground",
                      o.level === 3 ? "pl-6" : "pl-3",
                      activeHeading === o.id ? "border-accent text-foreground" : "border-border text-muted-foreground",
                    )}
                  >
                    {o.text}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {round && topics.length > 0 && (
          <>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Topics</p>
            <ul>
              {topics.map(([t, count]) => (
                <li key={t}>
                  <label className="flex cursor-pointer items-center justify-between gap-2 py-1.5 text-[13.5px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!hiddenTopics.has(t)}
                        onChange={() =>
                          setHiddenTopics((prev) => {
                            const s = new Set(prev);
                            if (s.has(t)) s.delete(t);
                            else s.add(t);
                            return s;
                          })
                        }
                        className="accent-[hsl(var(--accent))]"
                      />
                      <span className="truncate">{t}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {round && topics.length === 0 && (
          <>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">This round</p>
            <p className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              {done.has(round.id) ? "Finished reading" : "Scroll to the end to finish it"}
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
