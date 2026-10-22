import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/constants";
import { getAllPostSlugs, getCategories, POSTS_PER_PAGE } from "@/lib/queries/posts";
import { getPublishedBanks } from "@/lib/interview/bank";
import { getExamSlugs } from "@/lib/govt/query";
import { KIND_SLUG, NOTICE_KINDS } from "@/lib/govt/types";

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

  const [posts, categories, banks, exams] = await Promise.all([
    getAllPostSlugs(),
    getCategories(),
    getPublishedBanks(),
    getExamSlugs(),
  ]);

  // lastmod is a real date or nothing. It used to be the moment the sitemap
  // was built, on every page, which tells Google every page changed every ten
  // minutes and so that lastmod means nothing. Listing pages take the date of
  // the newest guide they show; pages with no meaningful date leave it out.
  const time = (iso: string) => new Date(iso).getTime();
  const latest = posts.length ? new Date(Math.max(...posts.map((p) => time(p.updated_at)))) : now;
  const catLatest = new Map<string, Date>();
  for (const p of posts) {
    const c = p.category?.slug;
    if (c && (!catLatest.has(c) || catLatest.get(c)!.getTime() < time(p.updated_at))) {
      catLatest.set(c, new Date(p.updated_at));
    }
  }
  const examLatest = exams.length ? new Date(Math.max(...exams.map((e) => time(e.updatedAt)))) : now;
  const blogPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));

  return [
    { url: SITE.url, lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/blog`, lastModified: latest, changeFrequency: "daily", priority: 0.9 },
    // The paginated archive: indexable, self-canonical, and the path to every
    // older guide (see app/(content)/blog/page/[page]).
    ...Array.from({ length: blogPages - 1 }, (_, i) => ({
      url: `${SITE.url}/blog/page/${i + 2}`,
      lastModified: latest,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    {
      url: `${SITE.url}/become-a-mentor`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    { url: `${SITE.url}/tools`, changeFrequency: "monthly", priority: 0.7 },
    // The running feed is indexable (see its page); the single-story pages are not.
    { url: `${SITE.url}/insights`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    // Trust pages: who we are and the rules we publish by.
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.5 },
    {
      url: `${SITE.url}/editorial-standards`,
      changeFrequency: "monthly",
      priority: 0.4,
    },

    /* Government jobs. The hub and the six kind pages are always submitted —
       they are the queries people type — while an exam page is listed only
       once it exists, so a sitemap never promises Google a page that 404s. */
    {
      url: `${SITE.url}/jobs`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${SITE.url}/government-jobs`,
      lastModified: examLatest,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    ...NOTICE_KINDS.map((k) => ({
      url: `${SITE.url}/government-jobs/${KIND_SLUG[k]}`,
      lastModified: examLatest,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    /* The three lifecycle views. They are derived from the same deadline the
       badges read, so they always have something to say once anything is
       published, and they are the shapes people search for ("last date
       today", "form closed"). Withdrawn listings are excluded upstream by
       getExamSlugs, which only returns published and closed rows. */
    ...(["closing-soon", "closed", "dates-not-stated"] as const).map((seg) => ({
      url: `${SITE.url}/government-jobs/${seg}`,
      lastModified: examLatest,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...exams.map((e) => ({
      url: `${SITE.url}/government-jobs/${e.slug}`,
      lastModified: new Date(e.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
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
      url: `${SITE.url}/resume-templates`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/tools/resume-ats-checker`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/tools/in-hand-salary-calculator`,
      lastModified: catLatest.get("salary") ?? latest,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE.url}/authors/cheatcode-team`,
      changeFrequency: "monthly",
      priority: 0.4,
    },

    // Low priority on purpose: these need to be findable and indexable — a
    // payment gateway checks that they resolve — without competing with the
    // guides for crawl budget.
    { url: `${SITE.url}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/refunds`, changeFrequency: "yearly", priority: 0.3 },

    ...categories.map((c) => ({
      url: `${SITE.url}/blog/category/${c.slug}`,
      lastModified: catLatest.get(c.slug) ?? latest,
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
