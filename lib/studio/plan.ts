/**
 * What the paid plan advertises, and what it costs.
 *
 * One list, because it appears on the promo card and on the upgrade screen,
 * and a benefit worded two ways is a benefit nobody trusts.
 *
 * ---------------------------------------------------------------- a caveat
 *
 * These five come from the design. Three of them exist today — the agent, the
 * builder, and the template set. Two do not: there is no mock-interview
 * feature and no human resume review anywhere in the product.
 *
 * That is survivable while nothing can be bought, because the card is a
 * statement of where the plan is going. It stops being survivable the moment
 * CHECKOUT_LIVE is true: at that point somebody is paying ₹99 for a list of
 * five things and receiving three, which is a refund conversation rather than
 * a marketing one. Either those two ship first, or they come off this list
 * before the checkout opens.
 */

export type Perk = { title: string; built: boolean };

export const PRO_PERKS: Perk[] = [
  { title: "AI Career Agent", built: true },
  { title: "AI Resume Builder", built: true },
  { title: "Premium Templates", built: true },
  { title: "AI Mock Interviews", built: false },
  { title: "Expert Resume Review", built: false },
];

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
