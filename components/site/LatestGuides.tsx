import Link from "next/link";
import { getPosts, getCategories } from "@/lib/queries/posts";
import { Reveal } from "./Reveal";
import { formatDate } from "@/components/content/bits";

/** Latest guides strip for the landing page. Renders nothing if the blog is empty. */
export async function LatestGuides() {
  const [{ posts }, categories] = await Promise.all([
    getPosts({ page: 1, perPage: 6 }),
    getCategories(),
  ]);

  if (posts.length === 0) return null;

  return (
    <section className="border-t border-ink-08 py-24 sm:py-36">
      <div className="container-page">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-ink-30">
                Free guides
              </p>
              <h2 className="mt-5 max-w-[20ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
                Start with what
                <span className="text-ink-30"> nobody told you.</span>
              </h2>
            </div>
            <Link
              href="/blog"
              className="shrink-0 rounded-full border border-ink-15 px-5 py-2.5 text-[0.85rem] font-medium transition-colors hover:border-ink"
            >
              All guides
            </Link>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-ink-70">
            Resumes, ATS, interviews, salary and the job hunt — written for Indian
            students and people in their first two years of work. Free, no signup.
          </p>
        </Reveal>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-ink-08 bg-ink-08 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <Reveal as="li" key={post.id} delay={(i % 3) * 70}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex h-full flex-col bg-paper p-7 transition-colors hover:bg-ink-04"
              >
                <div className="flex items-center gap-2.5 text-[0.72rem] text-ink-30">
                  {post.category && (
                    <span className="uppercase tracking-wider">
                      {post.category.short_name ?? post.category.name}
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{post.reading_minutes} min</span>
                </div>

                <h3 className="mt-3 text-[1.05rem] font-medium leading-snug tracking-[-0.02em]">
                  {post.title}
                </h3>

                <p className="mt-2.5 line-clamp-3 text-[0.9rem] leading-relaxed text-ink-50">
                  {post.excerpt}
                </p>

                <time
                  dateTime={post.published_at}
                  className="mt-5 text-[0.75rem] text-ink-30"
                >
                  {formatDate(post.published_at)}
                </time>
              </Link>
            </Reveal>
          ))}
        </ul>

        {categories.length > 0 && (
          <Reveal delay={140}>
            <ul className="mt-8 flex flex-wrap gap-2">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/blog/category/${c.slug}`}
                    className="inline-block rounded-full border border-ink-08 px-4 py-2 text-[0.82rem] text-ink-50 transition-colors hover:border-ink-30 hover:text-ink"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </section>
  );
}
