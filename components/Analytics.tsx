"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { EVENTS, track, trackPageView } from "@/lib/analytics/events";

const SITE_HOST = "cheatcodeapp.com";
const SCROLL_MARKS = [25, 50, 75, 100];

/**
 * The single listener that instruments the whole site.
 *
 * Rather than wiring a handler into every button, this delegates from the
 * document: any element carrying data-ev fires that event, and any link or
 * button without one still produces a sensible generic event. That means a
 * new CTA is tracked the moment it ships, with no chance of someone
 * forgetting to add the call.
 */
export function Analytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const marksHit = useRef<Set<number>>(new Set());
  const enteredAt = useRef<number>(Date.now());

  // ---------------------------------------------------------------- page view
  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return;
    if (pathname.startsWith("/admin")) return;

    // Send time spent on the page we're leaving.
    if (lastPath.current) {
      const seconds = Math.round((Date.now() - enteredAt.current) / 1000);
      if (seconds > 1 && seconds < 3600) {
        track(EVENTS.TIME_ON_PAGE, { value: seconds, label: lastPath.current });
      }
    }

    lastPath.current = pathname;
    marksHit.current = new Set();
    enteredAt.current = Date.now();

    trackPageView(pathname);

    if (pathname.startsWith("/blog/") && !pathname.startsWith("/blog/page")) {
      track(EVENTS.ARTICLE_VIEW, { label: pathname.replace("/blog/", "") });
    }
    if (pathname.startsWith("/tools/")) {
      track(EVENTS.TOOL_VIEW, { label: pathname.replace("/tools/", "") });
    }
  }, [pathname]);

  // ---------------------------------------------------------------- clicks
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Explicit instrumentation wins.
      const tagged = target.closest<HTMLElement>("[data-ev]");
      if (tagged) {
        const name = tagged.dataset.ev!;
        track(name as never, {
          label: tagged.dataset.evLabel ?? tagged.innerText?.trim().slice(0, 80),
          location: tagged.dataset.evLocation,
        });
        return;
      }

      // Otherwise: links get a sensible default so nothing is invisible.
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (link) {
        const href = link.getAttribute("href") ?? "";
        if (/^https?:\/\//i.test(href)) {
          let host = href;
          try {
            host = new URL(href).hostname;
          } catch {
            /* keep raw href */
          }
          if (!host.includes(SITE_HOST)) {
            track(EVENTS.OUTBOUND_CLICK, { label: host });
            return;
          }
        }
        if (href.startsWith("/") || href.startsWith("#")) {
          track(EVENTS.INTERNAL_LINK_CLICK, {
            label: href.slice(0, 120),
            location: link.closest("footer")
              ? "footer"
              : link.closest("header")
                ? "nav"
                : "body",
          });
        }
      }
    }

    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // ---------------------------------------------------------------- scroll depth
  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = Math.round((window.scrollY / scrollable) * 100);

      for (const mark of SCROLL_MARKS) {
        if (pct >= mark && !marksHit.current.has(mark)) {
          marksHit.current.add(mark);
          track(EVENTS.SCROLL_DEPTH, { value: mark, label: lastPath.current ?? "" });
          if (lastPath.current?.startsWith("/blog/")) {
            track(EVENTS.ARTICLE_READ, { value: mark, label: lastPath.current });
          }
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ---------------------------------------------------------------- leave
  useEffect(() => {
    function onHide() {
      if (document.visibilityState !== "hidden") return;
      const seconds = Math.round((Date.now() - enteredAt.current) / 1000);
      if (seconds > 1 && seconds < 3600) {
        track(EVENTS.TIME_ON_PAGE, { value: seconds, label: lastPath.current ?? "" });
      }
    }
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  return null;
}
