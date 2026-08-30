import Link from "next/link";
import type { Metadata } from "next";
import { getPosts, getCategories, getCategoryCounts, POSTS_PER_PAGE } from "@/lib/queries/posts";
import { buildMetadata } from "@/lib/seo/metadata";
import { ArticleCard, Pagination, Breadcrumbs } from "@/components/content/bits";
import { pickBanner } from "@/lib/queries/banners";
import { PromoBanner } from "@/components/content/PromoBanner";
import { JsonLd } from "@/components/JsonLd";
import { SITE } from "@/lib/seo/constants";

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: "Career Guides for Indian Job Seekers | Cheatcode",
  description:
    "Practical guides on resumes, ATS, interviews, salary and job search — written for Indian students and early-career professionals. No fluff, no paywalls.",
  path: "/blog",
});

export default async function BlogIndex() {
  const [{ posts, total }, categories, counts, banner] = await Promise.all([
    getPosts({ page: 1 }),
    getCategories(),
    getCategoryCounts(),
    pickBanner("blog_list", "/blog"),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

  return (
    <>
      <div className="container-page pt-12 sm:pt-16">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Guides" }]} />

        <h1 className="mt-6 max-w-[16ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
          Everything nobody
          <span className="text-ink-30"> told you.</span>
        </h1>
        <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink-70">
          Resumes, ATS, interviews, salary, LinkedIn and the job hunt — explained
          for Indian students and people in their first two years of work. Free,
          no signup, no paywall.
        </p>
      </div>

      <div className="container-page mt-14 grid gap-14 lg:grid-cols-[1fr_260px] lg:gap-20">
        <div>
          {posts.length === 0 ? (
            <p className="text-ink-50">No guides published yet.</p>
          ) : (
            <>
              {posts.map((post, i) => (
                <div key={post.id}>
                  <ArticleCard post={post} />
                  {banner && i === 3 && (
                    <div className="py-7">
                      <PromoBanner banner={banner} />
                    </div>
                  )}
                </div>
              ))}
              <Pagination page={1} totalPages={totalPages} basePath="/blog" />
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Topics
          </p>
          <ul className="mt-5 space-y-3">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/blog/category/${c.slug}`}
                  className="flex items-baseline justify-between gap-3 text-[0.9rem] text-ink-50 transition-colors hover:text-ink"
                >
                  <span>{c.name}</span>
                  <span className="text-[0.75rem] text-ink-30">{counts[c.slug] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="h-24" />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Cheatcode Guides",
          url: `${SITE.url}/blog`,
          inLanguage: "en-IN",
        }}
      />
    </>
  );
}
