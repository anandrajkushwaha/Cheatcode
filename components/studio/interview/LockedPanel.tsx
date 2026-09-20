import Link from "next/link";
import { PRO_PRICE_PER_MONTH } from "@/lib/studio/plan";
import { QUESTIONS_PER_INTERVIEW } from "@/lib/interview/plan";

/**
 * What a free account sees once MOCK_REQUIRES_PRO is switched on.
 *
 * Same artwork as the promo card and the agent's wall — /pro-bg.png — so the
 * three places Pro is sold read as one offer.
 *
 * A server component, unlike the agent's version: there is no dialog to
 * dismiss here because nothing is behind it. This is the screen.
 */
export function LockedPanel() {
  return (
    <div
      className="overflow-hidden rounded-[22px] border border-[#c8822f]/60 bg-black bg-[length:100%_100%] bg-no-repeat p-8 text-white sm:p-10"
      style={{ backgroundImage: "url('/pro-bg.png')" }}
    >
      <h2 className="max-w-[22ch] text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em]">
        Practise the interview before you sit in it
      </h2>
      <p className="mt-3 max-w-[46ch] text-[0.92rem] leading-relaxed text-white/75">
        {QUESTIONS_PER_INTERVIEW} questions written from the actual job you are
        applying to, and a report that quotes your own answers back to you with
        what to change.
      </p>

      <Link
        href="/studio/upgrade?from=interviews"
        className="mt-7 inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-3 text-[0.95rem] font-bold text-[#1a1a1a] transition-opacity hover:opacity-90"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgb(180,173,173) 0%, rgb(245,245,245) 50%, rgb(163,163,163) 100%)",
        }}
      >
        Unlock Pro ₹{PRO_PRICE_PER_MONTH}
      </Link>

      <p className="mt-3.5 text-[0.78rem] text-white/55">
        ₹{PRO_PRICE_PER_MONTH} a month · cancel any time
      </p>
    </div>
  );
}
