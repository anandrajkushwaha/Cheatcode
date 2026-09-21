"use client";

import Link from "next/link";
import { PRO_PERKS, PRO_PRICE_PER_MONTH } from "@/lib/studio/plan";
import { ClickToUpgrade } from "@/components/studio/ClickToUpgrade";

/**
 * What a free account sees when it tries to actually use the agent.
 *
 * It appears on the attempt, not on arrival. Letting somebody open the agent,
 * read the greeting and see the screen, and only then asking for money, is the
 * difference between a demo and a door — they have already seen what they are
 * buying by the time the price is mentioned.
 *
 * The background is /pro-bg.png, the same artwork as the promo card on the
 * studio home, so the two places Pro is sold look like one offer rather than
 * two campaigns.
 *
 * The copy is deliberately short and free of adjectives. "Unlimited AI-powered
 * career guidance, supercharge your job hunt" is the register people have
 * learned to skim; what actually sells at ₹99 is a plain sentence about what
 * happens next and a price that is obviously small.
 */

export function AgentPaywall({
  reason,
  onClose,
}: {
  /** Which door they walked into — the heading changes, nothing else does. */
  reason: "type" | "talk";
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-paper/80 px-4 backdrop-blur-md">
      <ClickToUpgrade href="/app/upgrade?from=agent-overlay" className="w-full max-w-[460px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-paywall-title"
        className="relative w-full max-w-[460px] overflow-hidden rounded-[22px] border border-[#c8822f]/60 bg-black bg-[length:100%_100%] bg-no-repeat p-7 text-white shadow-[0_24px_60px_-20px_rgb(0_0_0/0.5)] sm:p-8"
        style={{ backgroundImage: "url('/pro-bg.png')" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <h2 id="agent-paywall-title" className="max-w-[20ch] text-[1.35rem] font-bold leading-[1.2] tracking-[-0.02em]">
          {reason === "talk"
            ? "Talking to the agent is part of Pro"
            : "The agent answers on Pro"}
        </h2>

        <p className="mt-3 max-w-[38ch] text-[0.9rem] leading-relaxed text-white/75">
          It has read your resume and knows the roles you are after, so its
          answers are about you — not general advice you could have searched
          for.
        </p>

        <ul className="mt-6 space-y-2.5">
          {PRO_PERKS.filter((p) => p.built).map((perk) => (
            <li key={perk.title} className="flex items-center gap-2.5 text-[0.88rem] text-white/90">
              <svg viewBox="0 0 24 24" aria-hidden className="size-[15px] shrink-0 text-[#fdaa29]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7" />
              </svg>
              {perk.title}
            </li>
          ))}
        </ul>

        <Link
          href="/app/upgrade?from=agent-overlay"
          className="mt-7 flex w-full items-center justify-center whitespace-nowrap rounded-full px-6 py-3 text-[0.95rem] font-bold text-[#1a1a1a] transition-opacity hover:opacity-90"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgb(180,173,173) 0%, rgb(245,245,245) 50%, rgb(163,163,163) 100%)",
          }}
        >
          Unlock Pro ₹{PRO_PRICE_PER_MONTH}
        </Link>

        {/* The two objections people actually have, answered before they ask. */}
        <p className="mt-3.5 text-center text-[0.78rem] text-white/55">
          ₹{PRO_PRICE_PER_MONTH} a month · cancel any time
        </p>
      </div>
      </ClickToUpgrade>
    </div>
  );
}
