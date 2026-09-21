import type { Metadata } from "next";
import { getInsights } from "@/lib/insights/query";
import { InsightsReader } from "@/components/studio/InsightsReader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Insights — Cheatcode",
  robots: { index: false, follow: false },
};

/**
 * The news that affects your job search, one story at a time.
 *
 * Inshorts' shape on purpose: a single card fills the screen, a swipe (or the
 * arrow keys) moves to the next, and every card is 70 words with a link to
 * the full story. The point is that somebody can be up to date in two minutes
 * without opening a newspaper.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const [items, params] = await Promise.all([getInsights(80), searchParams]);
  return <InsightsReader items={items} startId={params.id ?? null} />;
}
