import "server-only";
import type { Insight } from "@/components/studio/InsightsPanel";

/**
 * What fills the Insights panel.
 *
 * Deliberately empty. The design shows three hiring-market cards, but nothing
 * in the schema produces them, and inventing the content in code would put
 * fake statistics about the Indian job market in front of real users — which
 * is worse than an empty panel, because an empty panel is obviously empty.
 *
 * Two honest options, and the choice is a product one rather than a technical
 * one:
 *
 *   1. Reuse `posts`. The blog already holds guides, it already has a title,
 *      an excerpt and a category, and the panel becomes a surface for content
 *      that exists. Cheapest, and it makes the blog work harder.
 *   2. A new `insights` table. Right if these are short market notes with
 *      their own cadence — things too small to be a guide.
 *
 * Until that is decided this returns nothing and the panel says so.
 */
export async function getInsights(): Promise<Insight[]> {
  return [];
}
