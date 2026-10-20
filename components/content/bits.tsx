import Link from "next/link";
import type { PostCard, TocItem } from "@/types/db";

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export function Breadcrumbs({
  items,
}: {
  items: { href?: string; label: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="text-[0.78rem] text-ink-30">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">›</span>}
            {item.href ? (
              <Link href={item.href} className="transition-colors hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span className="text-ink-50">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ArticleCard({
  post,
  context = "list",
}: {
  post: PostCard;
  /**
   * The same card appears in the blog index and in the "Keep reading" block
   * under an article. Those are different questions — one is browsing, the
   * other is whether related links keep a reader on the site — so they are
   * tracked as different events.
   */
  context?: "list" | "related";
}) {
  return (
    <article className="group border-b border-ink-08 py-7 first:pt-0">
      <Link
        href={`/blog/${post.slug}`}
        data-ev={context === "related" ? "related_post_click" : undefined}
        data-ev-label={post.slug}
        className="block"
      >
        <div className="flex items-center gap-2.5 text-[0.75rem] text-ink-30">
          {post.category && (
            <span className="uppercase tracking-wider">
              {post.category.short_name ?? post.category.name}
            </span>
          )}
          <span aria-hidden="true">·</span>
          <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
          <span aria-hidden="true">·</span>
          <span>{post.reading_minutes} min</span>
        </div>

        <h2 className="mt-2.5 text-[1.35rem] font-semibold leading-snug tracking-[-0.025em] transition-opacity group-hover:opacity-60">
          {post.title}
        </h2>

        <p className="mt-2.5 max-w-[68ch] text-[0.98rem] leading-relaxed text-ink-50">
          {post.excerpt}
        </p>
      </Link>
    </article>
  );
}

export function Toc({ items }: { items: TocItem[] }) {
  if (!items?.length) return null;
  return (
    <nav aria-label="On this page" className="rounded-2xl border border-ink-08 p-6">
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
        On this page
      </p>
      <ol className="mt-4 space-y-2.5">
        {items.map((item, i) => (
          <li key={`${item.id}-${i}`}>
            <a
              href={`#${item.id}`}
              data-ev="toc_click"
              data-ev-label={item.text}
              className="text-[0.88rem] leading-snug text-ink-50 transition-colors hover:text-ink"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Numbered pages plus Newer / Older, all plain links in the server HTML.
 *
 * Numbers matter for crawling, not only for people: with Newer/Older alone,
 * page 20 was twenty hops from /blog, and with a window of five it was still
 * eight (the crawl check found it). Every number is shown up to 30 pages.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) =>
    p === 1 ? basePath : `${basePath === "/blog" ? "/blog/page" : basePath}/${p}`;

  // Every page number while there are few enough to show (one click to any
  // page of the archive from any other); past that, first, last and two
  // either side of the current page.
  const shown = new Set<number>([1, totalPages]);
  const span = totalPages <= 30 ? totalPages : 2;
  for (let p = page - span; p <= page + span; p++) if (p >= 1 && p <= totalPages) shown.add(p);
  const nums = [...shown].sort((a, b) => a - b);

  return (
    <nav
      aria-label="Pagination"
      className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-ink-08 pt-8 text-[0.88rem]"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className="text-ink-50 transition-colors hover:text-ink">
          ← Newer
        </Link>
      ) : (
        <span />
      )}
      <ol className="flex flex-wrap items-center gap-1">
        {nums.map((n, i) => (
          <li key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-30">…</span>}
            {n === page ? (
              <span
                aria-current="page"
                className="grid h-8 min-w-8 place-items-center rounded-full bg-ink px-2 text-[0.8rem] text-paper"
              >
                {n}
              </span>
            ) : (
              <Link
                href={href(n)}
                className="grid h-8 min-w-8 place-items-center rounded-full px-2 text-[0.8rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
              >
                {n}
              </Link>
            )}
          </li>
        ))}
      </ol>
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className="text-ink-50 transition-colors hover:text-ink">
          Older →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
