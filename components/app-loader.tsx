"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { shouldTrackRequest } from "@/lib/loader-filter";

/**
 * Global loading indicator. Appears for:
 *  - client-side route navigations (internal <a> clicks, back/forward, pushState)
 *  - foreground API calls (fetch to /api/*, minus background pollers)
 *
 * Timing is tuned so it never flickers: it waits SHOW_DELAY before appearing, so
 * fast actions show nothing at all, and once visible it stays for at least
 * MIN_VISIBLE so it fades out deliberately rather than blinking.
 */

const SHOW_DELAY = 180; // don't show at all for anything faster than this
const MIN_VISIBLE = 450; // once shown, stay up at least this long
const NAV_TIMEOUT = 8000; // release a navigation hold that never resolved
const SAFETY = 25000; // absolute ceiling

export function AppLoader() {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const shownAt = useRef(0);

  const fetches = useRef(0);
  const navBusy = useRef(false);

  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pathname = usePathname();

  const setVisibleSafe = useCallback((v: boolean) => {
    visibleRef.current = v;
    setVisible(v);
  }, []);

  const busy = useCallback(() => fetches.current > 0 || navBusy.current, []);

  const requestShow = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (visibleRef.current || showTimer.current) return;
    showTimer.current = setTimeout(() => {
      showTimer.current = null;
      if (!busy()) return;
      shownAt.current = Date.now();
      setVisibleSafe(true);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      safetyTimer.current = setTimeout(() => {
        fetches.current = 0;
        navBusy.current = false;
        setVisibleSafe(false);
      }, SAFETY);
    }, SHOW_DELAY);
  }, [busy, setVisibleSafe]);

  const requestHide = useCallback(() => {
    if (busy()) return;
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
    if (!visibleRef.current) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const wait = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt.current));
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      if (!busy()) setVisibleSafe(false);
    }, wait);
  }, [busy, setVisibleSafe]);

  // A route change completed — release the navigation hold.
  useEffect(() => {
    navBusy.current = false;
    if (navTimer.current) clearTimeout(navTimer.current);
    requestHide();
  }, [pathname, requestHide]);

  // --- navigation detection ---
  useEffect(() => {
    function startNav() {
      navBusy.current = true;
      requestShow();
      if (navTimer.current) clearTimeout(navTimer.current);
      navTimer.current = setTimeout(() => {
        navBusy.current = false;
        requestHide();
      }, NAV_TIMEOUT);
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (
        !href ||
        a.target === "_blank" ||
        a.hasAttribute("download") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        /^https?:\/\//i.test(href)
      ) {
        return;
      }
      const dest = href.split("#")[0];
      if (dest === pathname || dest === `${pathname}/`) return;
      startNav();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", startNav);
    window.addEventListener("app:nav", startNav);

    const w = window as unknown as { __loaderPatched?: boolean };
    let unpatch: (() => void) | undefined;
    if (!w.__loaderPatched) {
      w.__loaderPatched = true;
      const origPush = history.pushState.bind(history);
      history.pushState = function (...args) {
        window.dispatchEvent(new Event("app:nav"));
        return origPush(...(args as Parameters<typeof origPush>));
      };
      unpatch = () => {
        history.pushState = origPush;
        w.__loaderPatched = false;
      };
    }

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", startNav);
      window.removeEventListener("app:nav", startNav);
      unpatch?.();
    };
  }, [pathname, requestShow, requestHide]);

  // --- foreground fetch detection ---
  useEffect(() => {
    const w = window as unknown as { __loaderFetch?: boolean };
    if (w.__loaderFetch) return;
    w.__loaderFetch = true;

    // MUST be bound — an unbound `fetch` called with `this === undefined` throws
    // "Illegal invocation" in browsers and breaks every request in the app.
    const orig = window.fetch.bind(window);

    window.fetch = function patchedFetch(...args: Parameters<typeof fetch>) {
      let tracked = false;
      // All bookkeeping is best-effort: the loader must never alter or break a request.
      try {
        const input = args[0];
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input instanceof Request
                ? input.url
                : "";
        const method = args[1]?.method ?? (input instanceof Request ? input.method : "GET");
        tracked = shouldTrackRequest(url, method);
        if (tracked) {
          fetches.current += 1;
          requestShow();
        }
      } catch {
        tracked = false;
      }

      // Return the original promise untouched so semantics are identical.
      const p = orig(...args);
      if (tracked) {
        const release = () => {
          fetches.current = Math.max(0, fetches.current - 1);
          requestHide();
        };
        // Both handlers so a rejection never becomes an unhandled rejection here.
        p.then(release, release);
      }
      return p;
    };

    return () => {
      window.fetch = orig;
      w.__loaderFetch = false;
    };
  }, [requestShow, requestHide]);

  // Clear every timer on unmount.
  useEffect(
    () => () => {
      [showTimer, hideTimer, navTimer, safetyTimer].forEach((t) => {
        if (t.current) clearTimeout(t.current);
      });
    },
    [],
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={visible}
      className={cn(
        "pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center",
        "bg-background/55 backdrop-blur-[2px]",
        "transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Scale lives on the wrapper — the ring owns its own transform. */}
      <div
        className={cn(
          "transition-transform duration-300 ease-out",
          visible ? "scale-100" : "scale-90",
        )}
      >
        <svg viewBox="0 0 50 50" className="loader-ring h-9 w-9">
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-border"
          />
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="loader-arc text-primary"
          />
        </svg>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
