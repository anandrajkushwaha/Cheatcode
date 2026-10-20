import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getPosts, POSTS_PER_PAGE } from "@/lib/queries/posts";
import { buildMetadata } from "@/lib/seo/metadata";
import { ArticleCard, Pagination, Breadcrumbs } from "@/components/content/bits";

export const revalidate = 300;

type Props = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  return buildMetadata({
    title: `Career Guides — Page ${page} | Cheatcode`,
    description:
      "More practical guides on resumes, ATS, interviews, salary and job search for Indian job seekers.",
    // Indexable, each with its own canonical. These were noindex, which left
    // Google free to stop crawling them — and they are a path to every older
    // guide. Google's own guidance for paginated series is a self-canonical
    // on each page, not noindex and not a canonical to page 1.
    path: `/blog/page/${page}`,
  });
}

export default async function BlogPaged({ params }: Props) {
  const { page: pageParam } = await params;
  const page = Number(pageParam);
  if (pageParam === "1") permanentRedirect("/blog");
  if (!Number.isInteger(page) || page < 2 || String(page) !== pageParam) notFound();

  const { posts, total } = await getPosts({ page });
  if (posts.length === 0) notFound();

  const totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));

  return (
    <div className="container-page py-12 sm:py-16">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/blog", label: "Guides" },
          { label: `Page ${page}` },
        ]}
      />
      <h1 className="mt-6 text-[length:var(--text-title)] font-semibold">
        Guides — page {page}
      </h1>

      <div className="mt-12 max-w-3xl">
        {posts.map((post) => (
          <ArticleCard key={post.id} post={post} />
        ))}
        <Pagination page={page} totalPages={totalPages} basePath="/blog" />
      </div>
    </div>
  );
}
