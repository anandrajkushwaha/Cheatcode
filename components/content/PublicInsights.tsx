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
export function PublicInsights({ items }: { items: Insight[] }) {
  return <InsightsReader items={items} startId={null} locked={useAuthStatus() !== "in"} />;
}
