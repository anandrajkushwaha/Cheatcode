import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostBySlug, getRelatedPosts, getAllPostSlugs } from "@/lib/queries/posts";
import { withHeadingIds } from "@/lib/content/render";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd } from "@/lib/seo/jsonld";
import {
  Breadcrumbs,
  Toc,
  FaqBlock,
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

  const related = await getRelatedPosts(post);
  const body = withHeadingIds(post.content_html, post.toc);
  const url = `${SITE.url}/blog/${post.slug}`;

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

        <header className="mt-7 max-w-[24ch]">
          <h1 className="text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05]">
            {post.h1 ?? post.title}
          </h1>
        </header>

        <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-ink-70">
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

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_260px] lg:gap-16">
          <div className="min-w-0">
            <div
              className="prose prose-cheatcode max-w-none prose-headings:font-semibold"
              dangerouslySetInnerHTML={{ __html: body }}
            />

            <FaqBlock items={post.faq} />

            {post.related_tool_slugs?.includes("in-hand-salary-calculator") && (
              <aside className="mt-14 rounded-3xl bg-ink p-8 text-paper">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-white/40">
                  Free tool
                </p>
                <p className="mt-2.5 text-xl font-medium tracking-[-0.02em]">
                  Work out what your CTC actually becomes in hand
                </p>
                <p className="mt-2.5 text-[0.95rem] leading-relaxed text-white/60">
                  Every deduction, current tax rules, no signup. Your numbers never
                  leave your browser.
                </p>
                <Link
                  href="/tools/in-hand-salary-calculator"
                  className="mt-6 inline-block rounded-full bg-paper px-5 py-2.5 text-[0.85rem] font-medium text-ink"
                >
                  Open the calculator
                </Link>
              </aside>
            )}

            <aside className="mt-14 rounded-3xl border border-ink-08 p-8">
              <p className="text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">
                Still stuck?
              </p>
              <p className="mt-2.5 text-xl font-medium tracking-[-0.02em]">
                Reading about it only gets you so far.
              </p>
              <p className="mt-2.5 max-w-[52ch] text-[0.95rem] leading-relaxed text-ink-50">
                Cheatcode gives you 30 minutes with someone 5–10 years ahead of you
                who has sat on the other side of the hiring table. Early access is free.
              </p>
              <Link
                href="/#waitlist"
                className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper"
              >
                Get early access
              </Link>
            </aside>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <Toc items={post.toc} />
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
              <ArticleCard key={p.id} post={p} />
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
