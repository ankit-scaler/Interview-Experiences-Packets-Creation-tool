"use client";

import { useEffect, useRef } from "react";

const TICK_MS = 20_000;

/** Fired by the packet reader when a round's last question comes into view. */
export const ROUND_DONE_EVENT = "packet:round-done";

const storageKey = (slug: string) => `rounds-done:${slug}`;

function loadDone(slug: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDone(slug: string, done: Set<string>) {
  try {
    window.localStorage.setItem(storageKey(slug), JSON.stringify([...done]));
  } catch {
    /* storage unavailable — progress still counts for this visit */
  }
}

/**
 * Records the learner's read on mount, then accumulates active time on the page
 * (paused when the tab is hidden) plus progress, flushing both to the server
 * periodically and on unload.
 *
 * Progress ("scrollPct") = rounds scrolled to the end ÷ total rounds, e.g. 2 of 4
 * rounds = 50%. Completed rounds are remembered per browser so a return visit
 * adds to them; the server only ever raises the stored value.
 */
export function ReadTracker({ slug, totalRounds }: { slug: string; totalRounds: number }) {
  const pending = useRef(0);
  const scrollPct = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    // Count the read once; listeners below must still re-attach if the effect
    // re-runs (React dev double-invokes effects).
    if (!started.current) {
      started.current = true;
      fetch(`/api/p/${slug}/read`, { method: "POST" }).catch(() => {});
    }

    let lastTick = Date.now();
    const done = loadDone(slug);
    // A packet with no rounds has nothing left to read.
    const measure = () => {
      scrollPct.current =
        totalRounds <= 0 ? 100 : Math.min(100, Math.round((done.size / totalRounds) * 100));
    };
    measure();

    const send = (body: string, useBeacon: boolean) => {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/p/${slug}/heartbeat`, new Blob([body], { type: "application/json" }));
      } else {
        fetch(`/api/p/${slug}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };

    const flush = (useBeacon = false) => {
      const secs = Math.round(pending.current);
      if (secs <= 0) return;
      pending.current = 0;
      send(JSON.stringify({ seconds: secs, scrollPct: scrollPct.current }), useBeacon);
    };

    const onRoundDone = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!id || done.has(id)) return;
      done.add(id);
      saveDone(slug, done);
      measure();
      // Send progress now — a learner who leaves within the tick shouldn't lose it.
      // seconds: 0 is fine; the heartbeat route records scroll on its own.
      send(JSON.stringify({ seconds: 0, scrollPct: scrollPct.current }), false);
    };

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        pending.current += (Date.now() - lastTick) / 1000;
        flush();
      }
      lastTick = Date.now();
    }, TICK_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        pending.current += (Date.now() - lastTick) / 1000;
        flush(true);
      }
      lastTick = Date.now();
    };
    const onHide = () => {
      pending.current += (Date.now() - lastTick) / 1000;
      flush(true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener(ROUND_DONE_EVENT, onRoundDone);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener(ROUND_DONE_EVENT, onRoundDone);
      onHide();
    };
  }, [slug, totalRounds]);

  return null;
}
