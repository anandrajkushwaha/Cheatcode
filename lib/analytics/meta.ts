/**
 * Meta Pixel — for measuring the Facebook and Instagram ads.
 *
 * Never on the admin panel and never for our own browsers (cc_owner). The
 * base code is in the page's <head> (components/MetaPixel.tsx); anything
 * tracked before it has run waits in a small queue and is replayed after
 * `init`. Bots are left to Meta's own filtering.
 *
 * Events, and where they fire:
 *   PageView          every page, including route changes (MetaPixel.tsx)
 *   Lead              a free ATS check finishes (components/tools/AtsChecker.tsx)
 *   InitiateCheckout  the Pro payment window is about to open (PayButton.tsx)
 *   Purchase          Razorpay reports the payment went through (PayButton.tsx)
 */

import { isOwner } from "@/lib/analytics/events";

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "1295966200273346";

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq & { queue?: unknown[] };
    __metaQueue?: unknown[][];
  }
}

/** Same two exclusions as the snippet in components/MetaPixel.tsx. */
function blocked(): boolean {
  if (typeof window === "undefined") return true;
  if (window.location.pathname.startsWith("/admin")) return true;
  return isOwner();
}

function send(...args: unknown[]) {
  if (blocked()) return;
  try {
    if (window.fbq) {
      window.fbq(...args);
      return;
    }
    const q = (window.__metaQueue ??= []);
    if (q.length < 50) q.push(args);
  } catch {
    /* an ad blocker — never break the page for it */
  }
}

export function metaPageView() {
  send("track", "PageView");
}

/**
 * A standard Meta event. `eventId` lets Meta drop a duplicate if the same
 * purchase is ever reported twice (say, the button's handler and a future
 * server-side event).
 */
export function metaTrack(
  event: "Lead" | "InitiateCheckout" | "Purchase" | "CompleteRegistration",
  params?: Record<string, unknown>,
  eventId?: string,
) {
  if (eventId) send("track", event, params ?? {}, { eventID: eventId });
  else if (params) send("track", event, params);
  else send("track", event);
}
