/**
 * What the paid plan actually buys.
 *
 * One list, because this appears in two places already — the promo block on
 * the studio home and the upgrade screen — and a benefit that is worded two
 * ways is a benefit nobody trusts.
 *
 * Every line here has to be something the product can do today or the day it
 * ships. The Figma carried "Auto-Apply on Naukri", which is neither: it is a
 * promise about automating another company's site, and we can neither deliver
 * it nor put their name on our pricing.
 *
 * NOTE: /app/upgrade still has its own hardcoded copy of this list. Point it
 * here when /app is cut over, and delete the copy there.
 */

export type Perk = { title: string; detail: string };

export const PRO_PERKS: Perk[] = [
  {
    title: "Talk to the agent",
    detail: "A real voice conversation about your career, not a chat box.",
  },
  {
    title: "Jobs ranked against your resume",
    detail: "With the reason spelled out, so you can disagree with it.",
  },
  {
    title: "Unlimited ATS checks",
    detail: "Rewrite, re-upload and re-score as often as you like.",
  },
];

/**
 * Whether anybody can actually buy this yet.
 *
 * Razorpay is not connected. Until it is, the promo has to ask to be told
 * rather than pretend to sell — a button that opens a dead checkout is worse
 * than a button that is honest about where the product is.
 */
export const CHECKOUT_LIVE = false;
