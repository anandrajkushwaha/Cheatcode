/**
 * What the paid plan advertises, and what stays free.
 *
 * One list per side, because they appear on the promo card, the upgrade
 * screen and the agent's paywall, and a benefit worded two ways is a benefit
 * nobody trusts.
 *
 * ------------------------------------------------------------ the free side
 *
 * Resume templates and the builder used to sit in the Pro column with a dash
 * under "Free" — while the code never gated either of them. So the product
 * gave them away and the marketing said it did not, which is the worst of both:
 * a free user saw a padlock that was not there and left, and a paying one was
 * charged for something the free plan already had. They are free, the page now
 * says so, and they are the reason to sign up rather than the reason to pay.
 *
 * ------------------------------------------------------------- the pro side
 *
 * Only what the server actually refuses to a free account: the agent beyond
 * its daily allowance, mock interviews (MOCK_REQUIRES_PRO) and the human
 * resume review (the /api/app/resume/review check). If a line here is not
 * enforced somewhere, somebody is paying for nothing.
 */

export type Perk = { title: string; built: boolean; free?: boolean };

/**
 * The full list, in the order the design draws it. Banners and the compare
 * table show all five, with a dash in every FREE cell, as designed. `free`
 * is not drawn on the cards; it only keeps the two free features out of
 * PRO_PERKS, the list of what paying unlocks.
 */
export const ALL_PERKS: Perk[] = [
  { title: "AI Career Agent", built: true },
  { title: "AI Resume Builder", built: true, free: true },
  { title: "Premium CV", built: true, free: true },
  { title: "AI Mock Interviews", built: true },
  { title: "Expert Resume Review", built: true },
];

/** Free on every account. */
export const FREE_PERKS: Perk[] = ALL_PERKS.filter((p) => p.free);

/** Only what ₹99 adds — for places that list what paying unlocks. */
export const PRO_PERKS: Perk[] = ALL_PERKS.filter((p) => !p.free);

/** As drawn. Kept here so the card and the upgrade screen cannot disagree. */
export const PRO_PRICE_LABEL = "Unlock Pro ₹99";

/**
 * Whether anybody can actually buy this is not decided here.
 *
 * It used to be a constant in this file, which meant the button could say one
 * thing while the server was configured to do another. It now comes from
 * billingConfigured() in lib/payments/razorpay.ts — the keys either exist or
 * they do not, and that is the only honest answer.
 *
 * This module stays free of anything secret so it can be imported from either
 * side of the wire.
 */
export const PRO_PRICE_PER_MONTH = 99;
