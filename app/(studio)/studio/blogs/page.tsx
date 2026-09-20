import Link from "next/link";
import { getPosts, getCategories } from "@/lib/queries/posts";

export const dynamic = "force-dynamic";

/**
 * Guides, inside the app.
 *
 * The same articles as the public blog, read from the same table — this is a
 * second door, not a second library. It exists because somebody mid-task
 * should not have to leave the product to read the thing that answers their
 * question, and because a signed-in reader is worth keeping signed in.
 *
 * Each article still opens on /blog, which is the canonical page and the one
 * Google indexes. Rebuilding the article view here would be a second renderer
 * for the same HTML, and the one nobody looks at is the one that breaks.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export default async function StudioBlogsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;

  const [{ posts }, categories] = await Promise.all([
    getPosts({ perPage: 24, categorySlug: c }),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Guides</h1>
        <Link
          href="/blog"
          target="_blank"
          className="text-[0.82rem] text-ink-50 underline-offset-4 hover:text-ink hover:underline"
        >
          Open the full blog ↗
        </Link>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip href="/studio/blogs" on={!c}>
            All
          </Chip>
          {categories.map((cat) => (
            <Chip key={cat.slug} href={`/studio/blogs?c=${cat.slug}`} on={c === cat.slug}>
              {cat.short_name || cat.name}
            </Chip>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-15 bg-paper p-8 text-center text-[0.87rem] leading-relaxed text-ink-30">
          {c ? "Nothing in this category yet." : "No guides published yet."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              target="_blank"
              className="group flex flex-col rounded-2xl border border-ink-08 bg-paper p-5 transition-all hover:border-ink-30 hover:shadow-[0_2px_14px_-6px_rgb(0_0_0/0.12)]"
            >
              {post.category && (
                <span className="text-[0.72rem] font-medium uppercase tracking-[0.12em] text-ink-30">
                  {post.category.short_name || post.category.name}
                </span>
              )}
              <h2 className="mt-2 line-clamp-2 text-[0.95rem] font-semibold leading-snug tracking-[-0.015em] group-hover:underline">
                {post.title}
              </h2>
              <p className="mt-2 line-clamp-3 text-[0.82rem] leading-relaxed text-ink-50">
                {post.excerpt}
              </p>
              <p className="mt-auto pt-4 text-[0.74rem] text-ink-30">
                {post.published_at ? WHEN.format(new Date(post.published_at)) : ""}
                {post.reading_minutes ? ` · ${post.reading_minutes} min read` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3.5 py-1.5 text-[0.8rem] transition-colors ${
        on
          ? "border-ink bg-ink text-paper"
          : "border-ink-15 bg-paper text-ink-50 hover:border-ink-30 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
