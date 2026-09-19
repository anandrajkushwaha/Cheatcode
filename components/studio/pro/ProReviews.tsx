"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReviewCard } from "@/components/studio/ReviewCard";
import type { Review } from "@/lib/studio/reviews";

/**
 * The testimonial carousel.
 *
 * Two cards at a time on a wide screen, one on a phone, and the page count
 * follows from that rather than from a fixed number — so adding a third
 * review in the admin panel adds a dot here and nothing else has to change.
 *
 * It scrolls rather than transforms: a native scroll container gives
 * swipe, trackpad, keyboard and screen readers the behaviour they already
 * expect, and the arrows below are a convenience on top of it, not the only
 * way through. The dots reflect the scroll position instead of driving it,
 * which is what keeps them honest when somebody swipes.
 */

export function ProReviews({ reviews }: { reviews: Review[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;

    // Pages come from how many cards fit, not from scrollWidth / clientWidth.
    // The gap makes those two disagree — with four cards two-up, the naive
    // division rounds to three, and the third dot scrolls to nothing.
    const first = el.firstElementChild as HTMLElement | null;
    const cardWidth = first?.offsetWidth ?? el.clientWidth;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    const perView = Math.max(1, Math.round(el.clientWidth / Math.max(1, cardWidth + gap)));

    const total = Math.max(1, Math.ceil(el.children.length / perView));
    setPages(total);

    const stride = perView * (cardWidth + gap);
    setPage(Math.min(total - 1, Math.round(el.scrollLeft / Math.max(1, stride))));
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, reviews.length]);

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(pages - 1, to));
    // Scroll to the first card of that page and let scroll-snap settle it,
    // rather than computing an exact offset that the gap would throw off.
    const target = el.children[next * Math.max(1, Math.round(el.children.length / pages))] as
      | HTMLElement
      | undefined;
    el.scrollTo({ left: target ? target.offsetLeft - el.offsetLeft : 0, behavior: "smooth" });
  }

  if (reviews.length === 0) return null;

  return (
    <section className="relative">
      <h2 className="mx-auto max-w-[30ch] text-center text-[1.15rem] font-bold leading-[1.35] tracking-[-0.01em] text-[#121224] sm:text-[1.4rem]">
        Join top professionals who have upgraded to Cheatcode Pro!
      </h2>

      <div className="relative mt-8">
        <div
          ref={track}
          onScroll={measure}
          className="cc-noscroll flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth"
        >
          {reviews.map((r) => (
            <div
              key={r.id}
              className="w-full shrink-0 snap-start sm:w-[calc(50%-10px)]"
            >
              <ReviewCard review={r} />
            </div>
          ))}
        </div>

        {pages > 1 && (
          <div className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 lg:-right-11 lg:block">
            <button
              type="button"
              onClick={() => go(page + 1 >= pages ? 0 : page + 1)}
              aria-label="Next testimonials"
              className="pointer-events-auto grid size-[35px] place-items-center rounded-full bg-[#121224] text-white transition-opacity hover:opacity-85"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-[14px]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-7 flex items-center justify-center gap-1.5">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Testimonials ${i + 1} of ${pages}`}
              aria-current={i === page}
              className={`h-[6px] rounded-full transition-all ${
                i === page ? "w-4 bg-[#2b3356]" : "w-[6px] bg-[#c7cbdb] hover:bg-[#9aa1bd]"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
