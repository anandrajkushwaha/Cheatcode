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

    // Send time spent on the page we're leaving. The address bar already shows
    // the new page by now, so the old path has to be passed explicitly or the
    // reading time gets filed against the wrong article.
    if (lastPath.current) {
      const seconds = Math.round((Date.now() - enteredAt.current) / 1000);
      if (seconds > 1 && seconds < 3600) {
        track(EVENTS.TIME_ON_PAGE, {
          value: seconds,
          label: lastPath.current,
          path: lastPath.current,
        });
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

  // ---------------------------------------------------------------- CTA seen
  /**
   * The funnel's first real step. Without this, "clicked a CTA" has no
   * denominator — you cannot tell a CTA nobody wants from a CTA nobody
   * scrolled far enough to see, and those two problems have opposite fixes.
   *
   * Fires once per CTA per page. The observer is rebuilt on navigation
   * because the CTAs on the new page are different elements.
   */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (pathname?.startsWith("/admin")) return;

    const seen = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || seen.has(entry.target)) continue;
          seen.add(entry.target);
          observer.unobserve(entry.target);

          const el = entry.target as HTMLElement;
          track((el.dataset.evView ?? EVENTS.CTA_VIEW) as never, {
            label: el.dataset.evLabel ?? el.innerText?.trim().slice(0, 80),
            location: el.dataset.evLocation,
          });
        }
      },
      // Half the element visible, so a CTA clipped at the fold doesn't count.
      { threshold: 0.5 },
    );

    // Re-query after paint so client-rendered CTAs are included.
    // Two kinds of element are watched: a CTA, whose view event is implied by
    // its click event, and anything carrying an explicit data-ev-view — which
    // is how a promo banner reports that it was actually seen rather than
    // merely present somewhere far below the fold.
    const id = window.setTimeout(() => {
      document
        .querySelectorAll<HTMLElement>('[data-ev="cta_click"], [data-ev-view]')
        .forEach((el) => observer.observe(el));
    }, 300);

    return () => {
      window.clearTimeout(id);
      observer.disconnect();
    };
  }, [pathname]);

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
        track(EVENTS.TIME_ON_PAGE, {
          value: seconds,
          label: lastPath.current ?? "",
          path: lastPath.current ?? undefined,
        });
      }
    }
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  return null;
}
