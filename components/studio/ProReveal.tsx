"use client";

import { useEffect, useState } from "react";

/**
 * The Pro card's opening: a greeting, then the card.
 *
 * Runs on every load, deliberately — it is tied to mount and nothing is
 * remembered, so a refresh replays it. That is what was asked for, and it is
 * also the only honest way to do it: persisting "already greeted" in storage
 * would make the card behave differently in a private window than in a normal
 * one for no reason a person could ever work out.
 *
 * ------------------------------------------------------------- no jumping
 *
 * The card's content is rendered the whole time and only faded, never removed.
 * Mounting it after the greeting would mean the card had no height while the
 * greeting played and then shoved the page down by two hundred pixels as it
 * landed. Hidden-but-present costs nothing and keeps the layout still.
 *
 * `inert` and aria-hidden go with the opacity, so a screen reader or a Tab
 * press cannot reach a card that is not visible yet.
 *
 * ------------------------------------------------------------ reduced motion
 *
 * Someone who has asked their system for less movement gets the card and no
 * greeting at all — checked before the first paint decision rather than
 * animating and then apologising.
 */

/**
 * How long the greeting holds before it leaves.
 *
 * 2.6s, not the 1.25s this started at: the shine takes most of a second to
 * cross the letters, and cutting a beat after it lands means the name is gone
 * before it has finished being read. This gives it a moment of stillness at
 * full brightness, which is the part that reads as deliberate rather than as
 * a loading state.
 */
const SHOW_MS = 2600;
const LEAVE_MS = 400;

type Phase = "greeting" | "leaving" | "done";

export function ProReveal({
  greeting,
  children,
}: {
  greeting: string;
  children: React.ReactNode;
}) {
  // Starts as "done" on the server and for anyone who wants less motion, so
  // the card is never withheld from someone the animation will not run for.
  const [phase, setPhase] = useState<Phase>("done");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setPhase("greeting");
    const toLeaving = window.setTimeout(() => setPhase("leaving"), SHOW_MS);
    const toDone = window.setTimeout(() => setPhase("done"), SHOW_MS + LEAVE_MS);

    return () => {
      window.clearTimeout(toLeaving);
      window.clearTimeout(toDone);
    };
  }, []);

  const showingGreeting = phase !== "done";

  return (
    <>
      {showingGreeting && (
        <div className="absolute inset-0 z-10 grid place-items-center px-6">
          <p
            className="cc-greet-wrap text-center"
            data-leaving={phase === "leaving" ? "true" : undefined}
          >
            <span className="cc-greet-text text-[clamp(1.75rem,4.2vw,2.6rem)] font-semibold tracking-[-0.03em]">
              {greeting}
            </span>
          </p>
        </div>
      )}

      <div
        className={`transition-opacity duration-500 ${
          showingGreeting ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden={showingGreeting || undefined}
        inert={showingGreeting || undefined}
      >
        {children}
      </div>
    </>
  );
}
