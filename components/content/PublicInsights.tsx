"use client";

import { useAuthStatus } from "@/components/site/AuthLinks";
import { InsightsReader } from "@/components/studio/InsightsReader";
import type { Insight } from "@/lib/insights/query";

/**
 * The same reader the app runs, on the public side of the sign-in wall.
 *
 * Not a second design of the same thing: the cards, the tabs, the snap
 * scrolling and the daily refresh are literally the app's component. The only
 * difference a signed-out visitor gets is `locked` — first story open, the
 * next two blurred, and the scroller stops there.
 *
 * Somebody already signed in gets the reader unlocked, so following a link
 * here from a search result does not send them back through a wall they are
 * already past. `unknown` counts as locked, which is the safe way round: the
 * wall appearing and then lifting is fine, the reverse gives the content away.
 */
/**
 * Above the frame on this page: the 4.5rem nav, the page padding, the title
 * row and the tabs — and a footer under it. Subtracting all of that plus a
 * little air is what keeps a whole card on screen, so the page itself never
 * has to scroll to finish one. Capped, so a tall desktop gets a readable card
 * rather than a metre of white space beside the text.
 *
 * `overscroll-auto`, unlike the app's reader: there the reader IS the screen
 * and containing the scroll is right, but here a footer sits below it. With
 * the scroll contained, a wheel or trackpad over the card snapped between
 * stories and then simply stopped — the page would not move until the pointer
 * was off the card, and then it lurched. Letting the scroll chain at the ends
 * is what takes the jerk out.
 */
const FRAME =
  "h-[clamp(380px,calc(100dvh-290px),700px)] overscroll-auto lg:h-[clamp(420px,calc(100dvh-270px),700px)]";

export function PublicInsights({ items }: { items: Insight[] }) {
  return (
    <InsightsReader
      items={items}
      startId={null}
      locked={useAuthStatus() !== "in"}
      frameClassName={FRAME}
    />
  );
}
