import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAuthorBySlug, getPostsByAuthor } from "@/lib/queries/posts";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { ArticleCard, Breadcrumbs } from "@/components/content/bits";

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) {
    return buildMetadata({ title: "Not found", description: "", path: `/authors/${slug}`, noindex: true });
  }
  return buildMetadata({
    title: `${author.name} — Cheatcode`,
    description: (author.bio ?? "").slice(0, 155) || `Guides written by ${author.name}.`,
    path: `/authors/${author.slug}`,
  });
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const posts = await getPostsByAuthor(author.id);

  return (
    <>
      <div className="container-page py-12 sm:py-16">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: author.name }]} />

        <h1 className="mt-6 text-[length:var(--text-display)] font-semibold leading-[1.02]">
          {author.name}
        </h1>
        {author.role_title && (
          <p className="mt-3 text-[0.95rem] text-ink-30">{author.role_title}</p>
        )}
        {author.bio && (
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-70">{author.bio}</p>
        )}
        {author.linkedin_url && (
          <a
            href={author.linkedin_url}
            rel="me noopener"
            className="mt-5 inline-block text-[0.88rem] text-ink-50 underline underline-offset-4 transition-colors hover:text-ink"
          >
            LinkedIn
          </a>
        )}

        <div className="mt-14 max-w-3xl">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            {posts.length} {posts.length === 1 ? "guide" : "guides"}
          </h2>
          <div className="mt-6">
            {posts.map((p) => (
              <ArticleCard key={p.id} post={p} />
            ))}
          </div>
        </div>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          mainEntity: {
            "@type": author.role_title?.toLowerCase().includes("team") ? "Organization" : "Person",
            name: author.name,
            description: author.bio ?? undefined,
            url: `${SITE.url}/authors/${author.slug}`,
            sameAs: author.linkedin_url ? [author.linkedin_url] : undefined,
          },
        }}
      />
    </>
  );
}
