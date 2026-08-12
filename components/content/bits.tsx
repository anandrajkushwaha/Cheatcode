import Link from "next/link";
import type { PostCard, TocItem, FaqItem } from "@/types/db";

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

export function FaqBlock({ items }: { items: FaqItem[] }) {
  if (!items?.length) return null;
  return (
    <section className="mt-16 border-t border-ink-08 pt-12">
      <h2 className="text-[1.65rem] font-semibold tracking-[-0.03em]">
        Frequently asked questions
      </h2>
      <div className="mt-6 divide-y divide-ink-08 border-t border-ink-08">
        {items.map((item, i) => (
          <details key={i} className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[1rem] font-medium leading-snug [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden="true" className="relative mt-1.5 size-3.5 shrink-0">
                <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-ink-50" />
                <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-ink-50 transition-transform duration-300 group-open:rotate-90 group-open:opacity-0" />
              </span>
            </summary>
            <p className="mt-3 max-w-[68ch] text-[0.97rem] leading-relaxed text-ink-50">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
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
