import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getCategories, getPosts } from "@/lib/queries/posts";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { ResumeCtaBar } from "@/components/content/ResumeCta";
import { isResumeCategory } from "@/lib/content/resume-cta";
import { JsonLd } from "@/components/JsonLd";
import { ArticleCard, Breadcrumbs } from "@/components/content/bits";
import { groupForHub } from "@/lib/content/hub-groups";

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

  // Every guide in the category, on one page: a category is two clicks from
  // /blog, so this keeps every post within three of the homepage. Hub
  // categories show them grouped (lib/content/hub-groups.ts).
  const { posts } = await getPosts({ categorySlug: slug, perPage: 300 });
  const groups = groupForHub(slug, posts);

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

        {/*
          The three resume categories get the builder offered before the list
          of articles. These pages are where somebody who searched for a resume
          format lands, and the list below is twenty-two more things to read —
          worth having, but not what most of them came to do.
        */}
        {isResumeCategory(cat.slug) && <ResumeCtaBar />}

        {cat.intro_html && (
          <div
            className="prose prose-cheatcode mt-8 max-w-[68ch]"
            dangerouslySetInnerHTML={{ __html: cat.intro_html }}
          />
        )}

        <p className="mt-8 text-[0.82rem] text-ink-30">
          {posts.length} {posts.length === 1 ? "guide" : "guides"}
        </p>

        {groups && groups.length > 1 && (
          <nav aria-label="Sections" className="mt-6 flex flex-wrap gap-2">
            {groups.map((g, i) => (
              <a
                key={g.title}
                href={`#group-${i + 1}`}
                className="rounded-full border border-ink-15 px-3.5 py-1.5 text-[0.8rem] text-ink-50 transition-colors hover:border-ink-30 hover:text-ink"
              >
                {g.title} <span className="text-ink-30">{g.posts.length}</span>
              </a>
            ))}
          </nav>
        )}

        <div className="mt-10 max-w-3xl">
          {posts.length === 0 ? (
            <p className="text-ink-50">Nothing here yet.</p>
          ) : groups ? (
            groups.map((g, i) => (
              <section key={g.title} id={`group-${i + 1}`} className="scroll-mt-24 pt-6 first:pt-0">
                <h2 className="text-[1.15rem] font-semibold tracking-[-0.02em]">{g.title}</h2>
                <div className="mt-2">
                  {g.posts.map((p) => (
                    <ArticleCard key={p.id} post={p} />
                  ))}
                </div>
              </section>
            ))
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
