import Image from "next/image";
import Link from "next/link";
import type { GuideCardPost } from "@/lib/queries/posts";
import { formatDate } from "@/components/content/bits";

/**
 * A guide as a picture card: cover image at 16:9, then category, title,
 * excerpt and date. Shared by the homepage strip and an article's "Keep
 * reading", so the two always look the same. A guide with no cover gets a
 * quiet category panel, so a row reads as four cards rather than a gap.
 */
export function GuideCard({ post }: { post: GuideCardPost }) {
  const label = post.category?.short_name ?? post.category?.name;
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-ink-08 bg-paper transition-colors hover:border-ink-30"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-ink-04">
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt={post.cover_alt || post.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-end p-5">
            <span className="text-[0.8rem] font-medium uppercase tracking-[0.14em] text-ink-30">
              {label ?? "Guide"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2.5 text-[0.72rem] text-ink-30">
          {label && <span className="uppercase tracking-wider">{label}</span>}
          <span aria-hidden="true">·</span>
          <span>{post.reading_minutes} min</span>
        </div>

        <h3 className="mt-3 line-clamp-3 text-[1.02rem] font-medium leading-snug tracking-[-0.02em]">
          {post.title}
        </h3>

        <p className="mt-2.5 line-clamp-2 text-[0.88rem] leading-relaxed text-ink-50">
          {post.excerpt}
        </p>

        <time dateTime={post.published_at} className="mt-auto pt-5 text-[0.75rem] text-ink-30">
          {formatDate(post.published_at)}
        </time>
      </div>
    </Link>
  );
}
