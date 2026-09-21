"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

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

  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("a, button, input, textarea, select, [data-own-click]")) return;
        // A drag-select of the copy is not a click on the card.
        if (window.getSelection()?.toString()) return;
        router.push(href);
      }}
      className={`cursor-pointer ${className}`}
    >
      {children}
    </div>
  );
}
