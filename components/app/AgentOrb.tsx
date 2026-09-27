"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AnimationItem, LottiePlayer } from "lottie-web";
import { useAuthStatus } from "@/components/site/AuthLinks";
import { primeAudio } from "@/lib/app/agent-sound";

/**
 * Loaded on press, not on paint. The overlay is the largest thing in the
 * product and the orb now sits on the marketing pages too, where most
 * visitors will never open it — shipping it with the landing page would be
 * paying for the agent on every visit that never uses it.
 */
const AgentOverlay = dynamic(
  () => import("@/components/app/AgentOverlay").then((m) => m.AgentOverlay),
  { ssr: false },
);

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
  requireAuth = false,
}: {
  placement?: "fixed" | "inline";
  /** Passed straight through: the orb opens for everybody, the agent gates. */
  requirePro?: boolean;
  /**
   * Public side of the wall. The overlay asks the account APIs who it is
   * talking to the moment it mounts, so it cannot simply be opened for a
   * visitor with no session — pressing the orb asks them to sign in instead.
   * Somebody who IS signed in is sent into the app with the agent already
   * opening, which puts the Pro question where it is actually answered
   * rather than keeping a second copy of that gate out here.
   */
  requireAuth?: boolean;
} = {}) {
  const host = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const anim = useRef<AnimationItem | null>(null);
  const [ready, setReady] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [asking, setAsking] = useState(false);

  const open = origin !== null;
  const router = useRouter();
  const status = useAuthStatus();
  // `unknown` counts as signed out. Offering to sign in to somebody who is
  // already in costs them one press; opening the agent for somebody who is
  // not leaves them looking at a broken conversation.
  const anonymous = requireAuth && status !== "in";

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

  // Arriving from the orb on the public site. That press was the intent to
  // talk; making them find the orb again on the other side of a navigation
  // would be asking for it twice.
  useEffect(() => {
    if (hidden || requireAuth) return;
    if (new URLSearchParams(window.location.search).get("agent") !== "1") return;
    const r = button.current?.getBoundingClientRect();
    setOrigin(
      r
        ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        : { x: window.innerWidth - 60, y: window.innerHeight - 60 },
    );
    // Out of the URL, so a refresh or a shared link is not stuck reopening it.
    const url = new URL(window.location.href);
    url.searchParams.delete("agent");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [hidden, requireAuth]);

  // Escape shuts the sign-in card the same way it shuts everything else.
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAsking(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking]);

  if (hidden) return null;

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => {
          if (anonymous) {
            setAsking((v) => !v);
            return;
          }
          if (requireAuth) {
            // Signed in, but out here on the public pages. The agent lives in
            // the app, where the account — and so the Pro answer — is known.
            router.push("/app?agent=1");
            return;
          }
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

      {asking && (
        <>
          {/* A press anywhere else puts it away. No dimming: this is a nudge
              beside a button, not a dialog that owns the screen. */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setAsking(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Sign in to talk to the agent"
            className="no-print fixed bottom-[7.5rem] right-5 z-50 w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl border border-ink-08 bg-paper p-5 text-left shadow-[0_18px_50px_-12px_rgb(0_0_0/0.28)] sm:bottom-[9rem] sm:right-7"
          >
            <p className="font-display text-[1.02rem] font-semibold tracking-[-0.015em]">
              Talk to your career agent
            </p>
            <p className="mt-2 text-[0.86rem] leading-relaxed text-ink-50">
              It reads your resume, finds roles and runs mock interviews. Sign in and it picks up
              from wherever you left off.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Link
                href="/signin?next=/app%3Fagent%3D1"
                data-ev="cta_click"
                data-ev-location="agent-orb"
                data-ev-label="Sign up free"
                onClick={() => setAsking(false)}
                className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
              >
                Sign up free
              </Link>
              <Link
                href="/signin?next=/app%3Fagent%3D1"
                data-ev="cta_click"
                data-ev-location="agent-orb"
                data-ev-label="Log in"
                onClick={() => setAsking(false)}
                className="text-[0.85rem] text-ink-50 transition-colors hover:text-ink"
              >
                Log in
              </Link>
            </div>
          </div>
        </>
      )}

      {origin && (
        <AgentOverlay origin={origin} onClose={() => setOrigin(null)} requirePro={requirePro} />
      )}
    </>
  );
}
