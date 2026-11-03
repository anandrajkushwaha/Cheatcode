import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { getManifest, getPost, templateCss, type MtPost } from "@/lib/moretraffic";
import { Breadcrumbs } from "@/components/content/bits";
import { LegacyArticle, legacyArticleMetadata, legacySlugs } from "../../_legacy-blog/post-page";
import { getPostBySlug } from "@/lib/queries/posts";

/**
 * /blog/[slug]: the original guide with that slug (app/(content)/_legacy-blog)
 * when there is one — the 300+ guides already indexed never depend on, wait
 * for, or get replaced by MoreTraffic — otherwise the MoreTraffic post; a
 * real 404 only when neither has it. Server-rendered, revalidated every 60s.
 */

export const revalidate = 60;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await legacySlugs()).map((slug) => ({ slug }));
}

/** The body HTML, whichever field the API puts it in. */
function bodyOf(p: MtPost): string {
  const r = p as unknown as Record<string, unknown>;
  for (const k of ["html", "contentHtml", "content_html", "content", "body"]) {
    if (typeof r[k] === "string" && (r[k] as string).trim()) return r[k] as string;
  }
  return "";
}

async function mtPost(slug: string): Promise<MtPost | null> {
  const r = await getPost(slug);
  return r.ok ? r.data : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const legacy = await legacyArticleMetadata(slug);
  if (legacy) return legacy;
  const post = await mtPost(slug);
  if (post) {
    const title = post.metaTitle?.trim() || post.title;
    const description = post.description ?? "";
    const base = buildMetadata({ title, description, path: `/blog/${post.slug}`, type: "article" });
    return {
      ...base,
      title: { absolute: title },
      openGraph: {
        title,
        description,
        url: `${SITE.url}/blog/${post.slug}`,
        siteName: SITE.name,
        type: "article",
        locale: SITE.locale,
        ...(post.hero?.url
          ? { images: [{ url: post.hero.url, width: post.hero.width, height: post.hero.height, alt: post.hero.alt ?? title }] }
          : {}),
      },
    };
  }
  return buildMetadata({ title: "Not found", description: "", path: `/blog/${slug}`, noindex: true });
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  // Our own guide first, exactly as before.
  if (await getPostBySlug(slug)) return <LegacyArticle slug={slug} />;

  const post = await mtPost(slug);
  if (!post) notFound();

  const css = templateCss(await getManifest());
  const html = bodyOf(post);
  if (!html) notFound();

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div className="container-page pt-10 sm:pt-14">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/blog", label: "Guides" }, { label: post.title }]} />
        {post.hero?.url && !html.includes("mt-hero") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.hero.url}
            width={post.hero.width}
            height={post.hero.height}
            alt={post.hero.alt ?? post.title}
            className="mt-8 h-auto w-full rounded-2xl"
          />
        )}
        <div className="mt-8" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <div className="h-24" />
    </>
  );
}
