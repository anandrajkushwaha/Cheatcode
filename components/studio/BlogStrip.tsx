import Link from "next/link";
import type { PostCard } from "@/types/db";

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/**
 * Dates are formatted here, on the server, in one fixed zone.
 *
 * The audience is in India and the server is not, so the machine's own zone
 * would put yesterday's date on this morning's post.
 */
function when(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE.format(d);
}

/**
 * The guides strip.
 *
 * The design labelled every card "Naukri blog", because the page it was drawn
 * over was theirs. These are our own guides, so the byline is our own category
 * — which is also more useful, since it says what the piece is about rather
 * than repeating where it came from three times.
 */
export function BlogStrip({ posts }: { posts: PostCard[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="rounded-2xl border border-ink-08 bg-paper p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[0.97rem] font-semibold tracking-[-0.02em]">
          Stay updated with our guides
        </h2>
        <Link
          href="/blog"
          className="shrink-0 text-[0.8rem] font-medium text-sky-1 hover:underline"
        >
          View all
        </Link>
      </div>

      <ul className="mt-5 grid gap-4 sm:grid-cols-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/blog/${post.slug}`}
              className="flex h-full flex-col rounded-xl border border-ink-08 p-4 transition-colors hover:border-ink-30"
            >
              <p className="line-clamp-3 text-[0.84rem] font-medium leading-snug text-ink">
                {post.title}
              </p>
              {/* The date is the part that must not wrap, so it keeps its
                  width and the category gives way first — the other way round
                  truncated "Salary" to "Sal…" while the date sat untouched. */}
              <p className="mt-auto flex items-center gap-1.5 pt-3 text-[0.71rem] text-ink-30">
                <span className="min-w-0 flex-1 truncate">
                  {post.category?.name ?? "Guide"}
                </span>
                {when(post.published_at) && (
                  <span className="shrink-0">{when(post.published_at)}</span>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The right rail's single card.
 *
 * Deliberately the newest guide, and deliberately not one of the three in the
 * strip above — the design had a blog list and a featured blog on the same
 * screen, which read as the same three posts twice. The page hands this the
 * first post and the strip the next three.
 */
export function FeaturedGuide({ post }: { post: PostCard | null }) {
  if (!post) return null;

  return (
    <section className="rounded-2xl border border-ink-08 bg-paper p-5">
      <p className="text-[0.67rem] font-medium uppercase tracking-[0.14em] text-ink-30">
        Latest guide
      </p>
      <p className="mt-3 text-[0.89rem] font-medium leading-snug text-ink">
        {post.title}
      </p>
      {post.excerpt && (
        <p className="mt-2 line-clamp-3 text-[0.78rem] leading-relaxed text-ink-50">
          {post.excerpt}
        </p>
      )}
      <Link
        href={`/blog/${post.slug}`}
        className="mt-4 inline-block text-[0.8rem] font-medium text-sky-1 hover:underline"
      >
        Know more
      </Link>
    </section>
  );
}
