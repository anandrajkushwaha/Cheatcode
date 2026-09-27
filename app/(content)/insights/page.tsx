import type { Metadata } from "next";
import { getInsights } from "@/lib/insights/query";
import { PublicInsights } from "@/components/content/PublicInsights";
import { SITE } from "@/lib/seo/constants";

export const revalidate = 1800;

/**
 * The public front door to Insights.
 *
 * The header's "Insights" link used to go straight to /signin, which asks
 * somebody to open an account before they have seen one thing they would be
 * opening it for. This is the same reader that runs inside the app — same
 * stories, same tabs, same morning refresh — with the first card open and the
 * wall behind it.
 *
 * Indexable, unlike the single shared /insights/[id] pages: one of those is 70
 * words about somebody else's report, but the running feed is a real page, and
 * it is a far better place for the Search ads to land than the home page.
 */
export const metadata: Metadata = {
  title: "Career Insights for India — hiring, pay and work rules | Cheatcode",
  description:
    "What is changing in hiring, salaries and work rules in India, in 70 words a piece. A new set every morning, free with a Cheatcode account.",
  alternates: { canonical: `${SITE.url}/insights` },
  openGraph: {
    title: "Cheatcode Insights",
    description:
      "What is changing in hiring, salaries and work rules in India, in 70 words a piece.",
    url: `${SITE.url}/insights`,
    siteName: SITE.name,
    type: "website",
  },
};

export default async function InsightsIndex() {
  const items = await getInsights(60);

  // The reader is sized to finish inside the first screen, which on a page
  // this short left the footer sitting straight under the card — its sign-up
  // banner already halfway up the fold. The space below puts the footer back
  // where a footer belongs: reached by scrolling, not met on arrival.
  return (
    <div className="container-page pt-6 pb-20 sm:pt-8 sm:pb-28">
      <PublicInsights items={items} />
    </div>
  );
}
