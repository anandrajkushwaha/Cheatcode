"use client";

import Link from "next/link";
import { useState } from "react";
import { PRO_PRICE_PER_MONTH } from "@/lib/studio/plan";
import { ClickToUpgrade } from "@/components/studio/ClickToUpgrade";

/**
 * The Pro banner, where a free account meets a paid feature.
 *
 * Same artwork as the promo card and the agent's wall — /pro-bg.png — so
 * every place Pro is sold reads as one offer rather than four campaigns.
 *
 * It opens rather than links straight out. Pressing a banner and landing on a
 * pricing page is a decision somebody has to make with no more information
 * than they had a second earlier; opening in place gives them the three
 * things they get first, and the button is still one press away. That is the
 * whole reason this is a component with state and not a styled anchor.
 */

export function ProTeaser({
  eyebrow,
  title,
  detail,
  points,
  from,
  defaultOpen = false,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  /** What they get. Three is the most anybody reads on a banner. */
  points: string[];
  /** Tagged onto the upgrade link, so the admin screen knows which door. */
  from: string;
  /**
   * Start expanded.
   *
   * Used where this is the whole screen rather than a strip on one — there is
   * nothing underneath to protect, so asking somebody to press once before
   * reading what they get is a press for nothing.
   */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <ClickToUpgrade href={`/app/upgrade?from=${from}`}>
    <div
      className="overflow-hidden rounded-[20px] border border-[#c8822f]/50 bg-black bg-[length:100%_100%] bg-no-repeat text-white"
      style={{ backgroundImage: "url('/pro-bg.png')" }}
    >
      {/* The whole card goes to the upgrade page; only the round chevron
          opens the list in place. */}
      <div className="flex w-full items-center justify-between gap-5 p-6 text-left sm:p-7">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[#fdaa29]">
            <LockIcon />
            {eyebrow}
          </span>
          <span className="mt-2 block max-w-[30ch] text-[1.15rem] font-bold leading-[1.2] tracking-[-0.02em] sm:text-[1.3rem]">
            {title}
          </span>
          <span className="mt-1.5 block max-w-[46ch] text-[0.85rem] leading-relaxed text-white/70">
            {detail}
          </span>
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Show less" : "See what you get"}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/50 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className={`size-[15px] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* A grid-rows transition rather than max-height: it animates to the
          content's real height, so a three-line list and a one-line list both
          open cleanly instead of one of them snapping. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6 sm:px-7 sm:pb-7">
            <ul className="space-y-2.5 border-t border-white/10 pt-5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[0.88rem] text-white/90">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className="mt-[3px] size-[15px] shrink-0 text-[#fdaa29]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>

            <Link
              href={`/app/upgrade?from=${from}`}
              className="mt-6 inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-3 text-[0.92rem] font-bold text-[#1a1a1a] transition-opacity hover:opacity-90"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgb(180,173,173) 0%, rgb(245,245,245) 50%, rgb(163,163,163) 100%)",
              }}
            >
              Unlock Pro ₹{PRO_PRICE_PER_MONTH}
            </Link>

            <p className="mt-3 text-[0.76rem] text-white/50">
              ₹{PRO_PRICE_PER_MONTH} a month · cancel any time
            </p>
          </div>
        </div>
      </div>
    </div>
    </ClickToUpgrade>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[12px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </svg>
  );
}
