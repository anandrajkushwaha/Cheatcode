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

export function ArticleCard({ post }: { post: PostCard }) {
  return (
    <article className="group border-b border-ink-08 py-7 first:pt-0">
      <Link href={`/blog/${post.slug}`} className="block">
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

  return (
    <nav
      aria-label="Pagination"
      className="mt-14 flex items-center justify-between border-t border-ink-08 pt-8 text-[0.88rem]"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className="text-ink-50 transition-colors hover:text-ink">
          ← Newer
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink-30">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className="text-ink-50 transition-colors hover:text-ink">
          Older →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
