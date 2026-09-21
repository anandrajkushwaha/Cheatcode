import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/constants";
import { getAllPostSlugs, getCategories } from "@/lib/queries/posts";
import { getPublishedBanks } from "@/lib/interview/bank";

/**
 * One sitemap, every URL, at /sitemap.xml.
 *
 * A single file is the right shape here: the limit is 50,000 URLs and we are
 * two orders of magnitude below it, so splitting would only give Google more
 * files to fetch and us more URLs to keep submitted. Scheduled posts appear
 * on their own — the query only returns rows whose published_at has passed,
 * and this revalidates every ten minutes.
 */
export const revalidate = 600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [posts, categories, banks] = await Promise.all([
    getAllPostSlugs(),
    getCategories(),
    getPublishedBanks(),
  ]);

  return [
    { url: SITE.url, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    {
      url: `${SITE.url}/become-a-mentor`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: `${SITE.url}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    // The question bank. Only published pages are ever returned, so a draft
    // can never be submitted to Google before somebody has read it.
    // The index only once it lists something — see its generateMetadata.
    ...(banks.length
      ? [
          {
            url: `${SITE.url}/interview-questions`,
            lastModified: now,
            changeFrequency: "weekly" as const,
            priority: 0.8,
          },
        ]
      : []),
    ...banks.map((b) => ({
      url: `${SITE.url}/interview-questions/${b.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${SITE.url}/tools/resume-ats-checker`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/tools/in-hand-salary-calculator`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/authors/cheatcode-team`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },

    // Low priority on purpose: these need to be findable and indexable — a
    // payment gateway checks that they resolve — without competing with the
    // guides for crawl budget.
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/refunds`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },

    ...categories.map((c) => ({
      url: `${SITE.url}/blog/category/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),

    ...posts.map((p) => ({
      url: `${SITE.url}/blog/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
