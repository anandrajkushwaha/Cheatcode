"use client";

import { useEffect, useRef } from "react";

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
  /**
   * Visible in the server HTML, with no wait for JavaScript.
   *
   * For anything above the fold. Everything here starts at opacity 0 and is
   * revealed by an IntersectionObserver after hydration — which on a phone on
   * 4G, inside Instagram's browser, is a blank screen for as long as the
   * bundle takes. The first thing an ad visitor sees cannot depend on that.
   */
  immediate?: boolean;
};

/**
 * Scroll-reveal wrapper. Uses IntersectionObserver so it costs ~nothing,
 * and CSS handles the transition (see globals.css [data-reveal]).
 * Respects prefers-reduced-motion via CSS.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
  immediate = false,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (immediate) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-reveal", "shown");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [immediate]);

  return (
    <Tag
      ref={ref as never}
      data-reveal={immediate ? "shown" : ""}
      style={{ ["--reveal-delay" as string]: `${delay}ms` }}
      className={className}
    >
      {children}
    </Tag>
  );
}
