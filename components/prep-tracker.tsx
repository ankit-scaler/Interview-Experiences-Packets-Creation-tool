"use client";

import { useEffect, type RefObject } from "react";
import { scrollSeenPct } from "@/lib/prep";

const TICK_MS = 20_000;
const SCROLL_DEBOUNCE_MS = 1_500;

/**
 * Mounted only while the Preparatory Kit is on screen. Registers the first read
 * (once the tab is visible), accumulates active time (paused when hidden) and the
 * furthest scroll depth of `targetRef`, and posts both to the kit API: on a 20s
 * tick, shortly after the depth climbs, and when the learner leaves.
 */
export function PrepTracker({ slug, targetRef }: { slug: string; targetRef: RefObject<HTMLElement> }) {
  useEffect(() => {
    const url = `/api/p/${slug}/prep`;
    let pending = 0; // unsent active seconds
    let maxPct = 0; // furthest depth seen
    let sentPct = -1; // depth last sent
    let registered = false;
    let lastTick = Date.now();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;

    const accrue = () => {
      if (document.visibilityState === "visible") pending += (Date.now() - lastTick) / 1000;
      lastTick = Date.now();
    };

    const send = (useBeacon: boolean) => {
      accrue();
      const seconds = Math.round(pending);
      pending = Math.max(0, pending - seconds);
      sentPct = maxPct;
      registered = true;
      const body = JSON.stringify({ seconds, scrollPct: maxPct });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    };

    const measure = () => {
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pct = scrollSeenPct(r.top, r.height, window.innerHeight);
      if (pct > maxPct) {
        maxPct = pct;
        if (registered) {
          clearTimeout(debounce);
          debounce = setTimeout(() => send(false), SCROLL_DEBOUNCE_MS);
        }
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    // Don't count a kit opened in a background tab until it is actually seen.
    const register = () => {
      if (registered || document.visibilityState !== "visible") return;
      measure();
      send(false);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (registered) send(true);
      } else {
        lastTick = Date.now();
        register();
      }
    };
    const onHide = () => {
      if (registered) send(true);
    };

    register();
    const interval = setInterval(() => {
      if (!registered) return register();
      accrue();
      if (pending >= 1 || maxPct !== sentPct) send(false);
    }, TICK_MS);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);

    return () => {
      clearInterval(interval);
      clearTimeout(debounce);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [slug, targetRef]);

  return null;
}
