"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AnimationItem, LottiePlayer } from "lottie-web";
import { AgentOverlay } from "@/components/app/AgentOverlay";
import { primeAudio } from "@/lib/app/agent-sound";

/**
 * The agent, as a thing in the corner.
 *
 * A Lottie rather than CSS because this one is a supplied asset and should
 * look exactly as it was drawn. Two details it needs that the file cannot
 * carry on its own:
 *
 *   1. The player ignores After Effects' Gaussian blur — effects are not part
 *      of what lottie-web renders — so the soft glow is put back with a CSS
 *      filter, and the circle is re-cut with an overflow-hidden mask so the
 *      blur cannot fray the edge.
 *   2. It is 1080×1080 of continuously animating SVG. Left running it would
 *      repaint forever on a page nobody is looking at, so it pauses when the
 *      tab is hidden and never starts at all under prefers-reduced-motion.
 *
 * Pressing it does not navigate. The whole screen becomes the agent, growing
 * out of this exact spot — which is why the button's centre is measured and
 * handed to the overlay.
 */
/**
 * Two placements, one orb.
 *
 * The old app parks it in the bottom-right corner; the studio sets it beside
 * the composer, where the design puts it. That is a difference of position
 * and size and nothing else — the Lottie, the reduced-motion handling, the
 * visibility pausing and the full-screen overlay are identical, which is why
 * this is a prop rather than a second component. A forked orb would have been
 * two things to keep in step for the rest of the product's life.
 */
export function AgentOrb({
  placement = "fixed",
  requirePro = false,
}: {
  placement?: "fixed" | "inline";
  /** Passed straight through: the orb opens for everybody, the agent gates. */
  requirePro?: boolean;
} = {}) {
  const host = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const anim = useRef<AnimationItem | null>(null);
  const [ready, setReady] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const open = origin !== null;

  // ...except the résumé editor, which is a full-screen surface of its own
  // with its own controls in that corner.
  const pathname = usePathname();
  const hidden = pathname?.startsWith("/app/resume/builder") ?? false;

  // The orb shows everywhere inside the shell. /app/agent used to hide it —
  // that page was a second frame around the same live conversation. It is now
  // a read-only record that resumes a past thread in its own overlay, so the
  // orb is once again the only way to start a new one and belongs on it too.
  useEffect(() => {
    if (hidden) return;
    const el = host.current;
    if (!el) return;

    let cancelled = false;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Imported here rather than at the top of the file so the player is only
    // fetched for signed-in pages that actually show the orb.
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
        /* No orb is a better outcome than a broken page. */
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
  }, [hidden]);

  // Nothing to animate behind a full-screen surface.
  useEffect(() => {
    if (!anim.current) return;
    if (open) anim.current.pause();
    else if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) anim.current.play();
  }, [open]);

  if (hidden) return null;

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => {
          // Start the audio context here rather than letting the overlay do
          // it on mount. This press is the gesture the browser wants, and it
          // buys the context a few hundred milliseconds to be running before
          // anything is scheduled into it — otherwise its first buffer is
          // filled while the main thread is mounting two Lottie players and
          // starting a canvas loop, and the chime arrives with a hole in it.
          primeAudio();

          const r = button.current?.getBoundingClientRect();
          setOrigin(
            r
              ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
              : { x: window.innerWidth - 60, y: window.innerHeight - 60 },
          );
        }}
        aria-label="Talk to the agent"
        aria-expanded={open}
        className={`no-print group flex items-center gap-3 transition-opacity duration-200 ${
          placement === "fixed"
            ? "fixed bottom-5 right-5 z-50 sm:bottom-7 sm:right-7"
            : "relative shrink-0"
        } ${open ? "pointer-events-none opacity-0" : "opacity-100"}`}
        style={
          placement === "fixed"
            ? { paddingBottom: "env(safe-area-inset-bottom, 0px)" }
            : undefined
        }
      >
        {/* The label only exists on pointer devices; on a phone the corner is
            tight and the orb has to speak for itself. Inline it is dropped
            entirely — there it sits against the composer, and a tooltip
            sliding out of it would cover the send button. */}
        {placement === "fixed" && (
          <span className="pointer-events-none hidden translate-x-2 rounded-full bg-ink px-3.5 py-1.5 text-[0.8rem] font-medium text-paper opacity-0 shadow-lg transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block">
            Talk to the agent
          </span>
        )}

        <span
          className={`relative grid place-items-center ${
            placement === "fixed"
              ? "h-[78px] w-[78px] sm:h-[86px] sm:w-[86px]"
              : "h-12 w-12 sm:h-14 sm:w-14"
          }`}
        >
          {/* Ground glow: the orb reads as lit rather than pasted on. */}
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full opacity-70 blur-xl transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: "radial-gradient(circle, #ffb347 0%, transparent 68%)" }}
          />

          <span
            aria-hidden="true"
            className="relative h-full w-full overflow-hidden rounded-full bg-paper shadow-[0_8px_24px_-8px_rgb(140_80_10/0.5),0_0_0_1px_rgb(0_0_0/0.05)] transition-transform duration-300 group-hover:scale-[1.06] group-active:scale-[0.96]"
          >
            {/* Scaled up and blurred: the artwork's own softness is an effect
                the player drops, and the overflow-hidden parent re-cuts the
                circle the blur would otherwise soften away. */}
            <span
              ref={host}
              className="absolute left-1/2 top-1/2 h-[132%] w-[132%] -translate-x-1/2 -translate-y-1/2 blur-[7px]"
            />

            {/* Until the player lands, a still version of the same colours —
                so the corner is never empty and never pops. */}
            {!ready && (
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 35% 30%, #fef5bd 0%, #f8e152 32%, #ff8e3a 62%, #ff7100 100%)",
                }}
              />
            )}
          </span>
        </span>
      </button>

      {origin && (
        <AgentOverlay origin={origin} onClose={() => setOrigin(null)} requirePro={requirePro} />
      )}
    </>
  );
}
