import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getCategories, getPosts } from "@/lib/queries/posts";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { ArticleCard, Breadcrumbs } from "@/components/content/bits";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const cats = await getCategories();
  return cats.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) {
    return buildMetadata({ title: "Not found", description: "", path: `/blog/category/${slug}`, noindex: true });
  }
  return buildMetadata({
    title: cat.seo_title ?? `${cat.name} | Cheatcode`,
    description: cat.seo_description ?? cat.description ?? "",
    path: `/blog/category/${cat.slug}`,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const { posts } = await getPosts({ categorySlug: slug, perPage: 60 });

  return (
    <>
      <div className="container-page py-12 sm:py-16">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/blog", label: "Guides" },
            { label: cat.name },
          ]}
        />

        <h1 className="mt-6 max-w-[18ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
          {cat.name}
        </h1>

        {cat.description && (
          <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink-70">
            {cat.description}
          </p>
        )}

        {cat.intro_html && (
          <div
            className="prose prose-cheatcode mt-8 max-w-[68ch]"
            dangerouslySetInnerHTML={{ __html: cat.intro_html }}
          />
        )}

        <p className="mt-8 text-[0.82rem] text-ink-30">
          {posts.length} {posts.length === 1 ? "guide" : "guides"}
        </p>

        <div className="mt-10 max-w-3xl">
          {posts.length === 0 ? (
            <p className="text-ink-50">Nothing here yet.</p>
          ) : (
            posts.map((p) => <ArticleCard key={p.id} post={p} />)
          )}
        </div>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: cat.name,
          description: cat.description ?? undefined,
          url: `${SITE.url}/blog/category/${cat.slug}`,
          inLanguage: "en-IN",
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
            { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE.url}/blog` },
            {
              "@type": "ListItem",
              position: 3,
              name: cat.name,
              item: `${SITE.url}/blog/category/${cat.slug}`,
            },
          ],
        }}
      />
    </>
  );
}
