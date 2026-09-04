"use client";

import { useEffect, useRef } from "react";

const TICK_MS = 20_000;

/**
 * Records the learner's read on mount, then accumulates active time on the page
 * (paused when the tab is hidden) plus how far down they got, flushing both to
 * the server periodically and on unload.
 */
export function ReadTracker({ slug }: { slug: string }) {
  const pending = useRef(0);
  const scrollPct = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch(`/api/p/${slug}/read`, { method: "POST" }).catch(() => {});

    let lastTick = Date.now();

    /** Furthest point reached, as a % of the scrollable page. */
    const measureScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // A packet shorter than the viewport has nothing to scroll to — the
      // learner has seen all of it, so that counts as 100 rather than 0.
      const pct = scrollable <= 0 ? 100 : ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
      scrollPct.current = Math.max(scrollPct.current, Math.min(100, Math.round(pct)));
    };
    measureScroll();

    const flush = (useBeacon = false) => {
      const secs = Math.round(pending.current);
      measureScroll();
      if (secs <= 0) return;
      pending.current = 0;
      const body = JSON.stringify({ seconds: secs, scrollPct: scrollPct.current });
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
    window.addEventListener("scroll", measureScroll, { passive: true });
    window.addEventListener("resize", measureScroll);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("scroll", measureScroll);
      window.removeEventListener("resize", measureScroll);
      onHide();
    };
  }, [slug]);

  return null;
}
