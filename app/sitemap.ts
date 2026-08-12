import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo/constants";
import { getAllPostSlugs, getCategories } from "@/lib/queries/posts";

export const revalidate = 600;

/** Sharded from day one — Google crawls smaller sitemaps more reliably. */
export async function generateSitemaps() {
  return [{ id: "static" }, { id: "posts" }, { id: "categories" }];
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const shard = await id;
  const now = new Date();

  if (shard === "posts") {
    const posts = await getAllPostSlugs();
    return posts.map((p) => ({
      url: `${SITE.url}/blog/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));
  }

  if (shard === "categories") {
    const cats = await getCategories();
    return cats.map((c) => ({
      url: `${SITE.url}/blog/category/${c.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  }

  return [
    { url: SITE.url, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/blog`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/tools`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
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
  ];
}
