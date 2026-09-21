"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

/**
 * Makes a whole Pro card or popup a way to the upgrade page.
 *
 * People tap the artwork, the heading, the list of perks — rarely just the
 * button — and a card that ignores those taps reads as broken. So any click
 * inside goes to `href`.
 *
 * Except on a control that has a job of its own: a link already goes where
 * it goes, and a button (close, expand) must keep doing what it says. Those
 * are left alone by checking what was actually clicked, rather than wrapping
 * the card in an <a> — an anchor cannot legally contain buttons or other
 * links, and browsers repair that markup in ways that break both.
 *
 * ------------------------------------------------------------ feeling instant
 *
 * The first version called router.push and did nothing else, so for the
 * half-second the server took there was no sign the tap had landed. Three
 * things fix that: the route is prefetched as soon as the card is on screen;
 * the card visibly presses on pointer-down, before the click even fires; and
 * while the navigation is pending it stays dimmed, so a slow network reads as
 * "working", not "missed".
 */
export function ClickToUpgrade({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    router.prefetch(href);
  }, [router, href]);

  const ownControl = (el: EventTarget | null) =>
    (el as HTMLElement | null)?.closest?.("a, button, input, textarea, select, [data-own-click]");

  return (
    <div
      onPointerDown={(e) => {
        if (!ownControl(e.target)) setPressed(true);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={(e) => {
        if (ownControl(e.target)) return;
        // A drag-select of the copy is not a click on the card.
        if (window.getSelection()?.toString()) return;
        startTransition(() => router.push(href));
      }}
      aria-busy={pending || undefined}
      className={`cursor-pointer transition-[transform,opacity] duration-150 ease-out ${
        pressed ? "scale-[0.985]" : ""
      } ${pending ? "cursor-progress opacity-80" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
