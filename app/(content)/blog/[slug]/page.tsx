import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostBySlug, getRelatedPosts, getAllPostSlugs } from "@/lib/queries/posts";
import { pickBanner } from "@/lib/queries/banners";
import { PromoBanner } from "@/components/content/PromoBanner";
import { withHeadingIds } from "@/lib/content/render";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd } from "@/lib/seo/jsonld";
import { FaqBlock } from "@/components/content/FaqBlock";
import { ArticleShare } from "@/components/content/ArticleShare";
import { ToolBlock } from "@/components/content/ToolBlock";
import { ResumeCtaBar, ResumeCtaBlock } from "@/components/content/ResumeCta";
import { ResumeBanner } from "@/components/content/ResumeBanner";
import { isResumeCategory } from "@/lib/content/resume-cta";
import {
  Breadcrumbs,
  Toc,
  ArticleCard,
  formatDate,
} from "@/components/content/bits";

export const revalidate = 300;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const slugs = await getAllPostSlugs();
  return slugs.slice(0, 200).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return buildMetadata({ title: "Not found", description: "", path: `/blog/${slug}`, noindex: true });

  return {
    ...buildMetadata({
      title: post.seo_title,
      description: post.seo_description,
      path: `/blog/${post.slug}`,
      type: "article",
      noindex: post.noindex,
    }),
    keywords: [post.focus_keyword, ...(post.secondary_keywords ?? [])],
    openGraph: {
      title: post.seo_title,
      description: post.seo_description,
      url: `${SITE.url}/blog/${post.slug}`,
      siteName: SITE.name,
      type: "article",
      locale: SITE.locale,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      authors: post.author?.name ? [post.author.name] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const [related, inArticleBanner, sidebarBanner] = await Promise.all([
    getRelatedPosts(post),
    pickBanner("in_article", post.slug),
    pickBanner("sidebar", post.slug),
  ]);
  const body = withHeadingIds(post.content_html, post.toc);
  const url = `${SITE.url}/blog/${post.slug}`;
  const resumeArticle = isResumeCategory(post.category?.slug);

  return (
    <>
      <article className="container-page pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/blog", label: "Guides" },
            ...(post.category
              ? [{ href: `/blog/category/${post.category.slug}`, label: post.category.name }]
              : []),
            { label: post.title },
          ]}
        />

        {/* No ch-based cap here: long headlines were being squeezed into a
            narrow column. leading is >1.1 with a little bottom padding so
            descenders never clip against the tight tracking. */}
        <header className="mt-7 max-w-[46rem]">
          <h1 className="pb-1 text-[clamp(1.9rem,3.9vw,3rem)] font-semibold leading-[1.14] tracking-[-0.03em]">
            {post.h1 ?? post.title}
          </h1>
        </header>

        <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-ink-70">
          {post.excerpt}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-ink-08 py-4 text-[0.82rem] text-ink-50">
          {post.author && (
            <>
              <span className="font-medium text-ink">{post.author.name}</span>
              {post.author.role_title && (
                <span className="text-ink-30">{post.author.role_title}</span>
              )}
              <span aria-hidden="true" className="text-ink-15">·</span>
            </>
          )}
          <time dateTime={post.published_at}>
            Published {formatDate(post.published_at)}
          </time>
          {post.updated_at !== post.published_at && (
            <>
              <span aria-hidden="true" className="text-ink-15">·</span>
              <time dateTime={post.updated_at}>Updated {formatDate(post.updated_at)}</time>
            </>
          )}
          <span aria-hidden="true" className="text-ink-15">·</span>
          <span>{post.reading_minutes} min read</span>
        </div>

        {post.cover_image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.cover_image}
            alt={post.cover_alt ?? ""}
            className="mt-10 w-full rounded-3xl border border-ink-08 object-cover"
            style={{ aspectRatio: "16 / 9" }}
          />
        )}

        {resumeArticle && <ResumeCtaBar />}

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_260px] lg:gap-16">
          <div className="min-w-0">
            <div
              className="prose prose-cheatcode max-w-none prose-headings:font-semibold"
              dangerouslySetInnerHTML={{ __html: body }}
            />

            <FaqBlock items={post.faq} />

            <ToolBlock slugs={post.related_tool_slugs} />

            {/*
              After the answer, not before it. A share row above the article
              asks somebody to recommend a thing they have not read yet, and
              is ignored; here it is offered at the one moment the piece has
              already been useful.
            */}
            <ArticleShare title={post.title} path={`/blog/${post.slug}`} />

            {/*
              Below `lg` the sidebar is not beside the article, it is stacked
              underneath the whole of it — past the FAQ, past the related
              posts. On a two-thousand-word guide read on a phone, which is
              most of this traffic, that is an ad nobody reaches. This is the
              same banner in the flow of the page instead; exactly one of the
              two ever renders.
            */}
            <div className="mt-14 lg:hidden">
              <ResumeBanner location="in-article" />
            </div>

            {inArticleBanner && (
              <div className="mt-14">
                <PromoBanner banner={inArticleBanner} />
              </div>
            )}

            {/*
              Two offers, one per article, chosen by what the article is about.
              Not both: a page that ends with "build a resume" *and* "book a
              mentor" is a page that has decided nothing, and the reader picks
              neither. The resume guides get the builder because it is the
              thing they were just reading how to do; everything else keeps the
              mentor pitch it already had.
            */}
            {resumeArticle ? (
              <ResumeCtaBlock />
            ) : (
            <aside className="mt-14 rounded-3xl border border-ink-08 p-8">
              <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">
                Still stuck?
              </p>
              <p className="mt-2.5 text-xl font-medium tracking-[-0.02em]">
                Reading about it only gets you so far.
              </p>
              <p className="mt-2.5 max-w-[52ch] text-[0.95rem] leading-relaxed text-ink-50">
                A free Cheatcode account gets you a resume builder with 60
                templates, an ATS check, and a career agent that has read your
                resume — so your next question gets an answer about you, not
                about everyone.
              </p>
              <Link
                href="/signin?next=/app"
                data-ev="cta_click"
                data-ev-location="article-account-block"
                data-ev-label="Sign up"
                className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper"
              >
                Create a free account
              </Link>
            </aside>
            )}
          </div>

          {/*
            The sticky column is capped at the viewport, and the contents list
            is the part that gives way.

            Without the cap this column was as tall as whatever was in it —
            about 1300px on an article with fourteen headings — and a sticky
            box taller than the window cannot be scrolled: its top is pinned,
            so everything past the fold is simply unreachable. The banner sat
            at y=1005 in a 900px window and never appeared, on any desktop
            size, on the seventy articles whose contents list runs to nine
            items or more. It was not subtly cut off; it was invisible.

            So: `max-h` on the column, `min-h-0 overflow-y-auto` on the list
            so it shrinks and scrolls inside itself, `shrink-0` on the banner
            so it never does. The list stays completely usable — it just
            scrolls — and the thing that was losing 100% of its impressions
            is now always on screen.

            The scheduled `promo_banners` slot rides with the list rather than
            with the banner, because it is optional and this is not: two
            stacked ads could push the column over the cap again, and the one
            that should survive that is the house ad.
          */}
          <aside className="min-w-0 lg:block">
            <div className="sticky top-24 flex max-h-[calc(100vh-7rem)] flex-col gap-6">
              <div className="hidden min-h-0 flex-1 overflow-y-auto lg:block">
                <Toc items={post.toc} />
                {sidebarBanner && (
                  <div className="mt-6">
                    <PromoBanner banner={sidebarBanner} />
                  </div>
                )}
              </div>
              {/*
                On every article, not only the resume ones. A person reading
                about interview answers or notice periods still has a résumé,
                and this is the product — the offer that is always worth making.
              */}
              <div className="hidden shrink-0 lg:block">
                <ResumeBanner location="sidebar" />
              </div>
            </div>
          </aside>
        </div>
      </article>

      {related.length > 0 && (
        <section className="container-page mt-24 border-t border-ink-08 pt-12">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Keep reading
          </h2>
          <div className="mt-6 max-w-3xl">
            {related.map((p) => (
              <ArticleCard key={p.id} post={p} context="related" />
            ))}
          </div>
        </section>
      )}

      <div className="h-24" />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.seo_description,
          datePublished: post.published_at,
          dateModified: post.updated_at,
          inLanguage: "en-IN",
          wordCount: post.word_count,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          author: post.author
            ? {
                "@type": "Person",
                name: post.author.name,
                description: post.author.role_title ?? undefined,
                url: post.author.linkedin_url ?? `${SITE.url}/authors/${post.author.slug}`,
              }
            : { "@type": "Organization", name: SITE.name },
          publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
        }}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
            { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE.url}/blog` },
            ...(post.category
              ? [
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: post.category.name,
                    item: `${SITE.url}/blog/category/${post.category.slug}`,
                  },
                ]
              : []),
            {
              "@type": "ListItem",
              position: post.category ? 4 : 3,
              name: post.title,
              item: url,
            },
          ],
        }}
      />

      {post.faq?.length > 0 && <JsonLd data={faqJsonLd(post.faq)} />}
    </>
  );
}
