"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationItem, LottiePlayer } from "lottie-web";

/**
 * The orb, used as a letter.
 *
 * The same ai-orb.json the agent's button plays, not a gradient that looks
 * like it — so the O in PRO is literally the product's mark rather than a
 * second drawing of it that drifts the day the artwork changes.
 *
 * Two details carried over from AgentOrb, for the same reasons:
 *
 *   The player ignores After Effects' Gaussian blur, so the softness is put
 *   back with a CSS filter and the circle re-cut with an overflow-hidden
 *   mask, or the blur frays the edge.
 *
 *   It is 1080x1080 of continuously animating SVG. It pauses with the tab and
 *   never starts at all under prefers-reduced-motion.
 *
 * The gradient underneath is not a fallback bolted on — it paints first and
 * the player covers it, so a blocked or slow chunk leaves a still orb of the
 * right colour rather than a hole in a word.
 */
export function OrbMark({ className = "" }: { className?: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const anim = useRef<AnimationItem | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let cancelled = false;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("lottie-web/build/player/lottie_light")
      .then((mod) => {
        if (cancelled || !host.current) return;
        const lottie = ((mod as { default?: LottiePlayer }).default ?? mod) as LottiePlayer;
        anim.current = lottie.loadAnimation({
          container: host.current,
          renderer: "svg",
          loop: true,
          autoplay: !still,
          path: "/ai-orb.json",
          rendererSettings: { progressiveLoad: true },
        });
        setReady(true);
      })
      .catch(() => {
        /* The gradient below is already correct; no orb is better than a gap. */
      });

    const onVisibility = () => {
      if (!anim.current || still) return;
      if (document.hidden) anim.current.pause();
      else anim.current.play();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      anim.current?.destroy();
      anim.current = null;
    };
  }, []);

  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className}`}
      style={{
        background: "radial-gradient(circle at 32% 30%, #ffd9a0, #ff9d4d 45%, #f4703a)",
      }}
    >
      <span
        ref={host}
        className={`absolute left-1/2 top-1/2 h-[132%] w-[132%] -translate-x-1/2 -translate-y-1/2 blur-[2px] transition-opacity duration-300 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
