import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditPosts, type AuditPost, type Severity } from "@/lib/seo/audit";
import { Empty } from "@/components/admin/ui";

/**
 * SEO audit — every live article, worst first.
 *
 * Under /admin/posts so it shares the Articles permission: whoever writes the
 * guides can see what each one needs. It reads the live rows on every load
 * and changes nothing; the fixes are made in the article editor, one link
 * away on each row.
 */

const TONE: Record<Severity, string> = {
  high: "bg-[#fde8e8] text-[#9b1c1c]",
  medium: "bg-[#fdf3e1] text-[#8a5300]",
  low: "bg-ink-04 text-ink-50",
};

export default async function SeoAudit({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const sp = await searchParams;
  const db = createAdminClient();
  if (!db) return <Empty>Supabase is not configured.</Empty>;

  const { data, error } = await db
    .from("posts")
    .select(
      "slug,title,seo_title,seo_description,focus_keyword,content_html,faq,noindex,status,published_at,category:categories(name)",
    )
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(5000);

  if (error) return <Empty>Could not load articles: {error.message}</Empty>;

  const rows: AuditPost[] = ((data ?? []) as unknown as (AuditPost & {
    category: { name: string } | null;
  })[]).map((r) => ({ ...r, category: r.category?.name ?? null }));

  const audit = auditPosts(rows);
  const showAll = sp.show === "all";
  const list = showAll ? audit.posts : audit.posts.filter((p) => p.issues.length > 0);
  const clean = audit.posts.length - audit.posts.filter((p) => p.issues.length > 0).length;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">SEO audit</h1>
        <Link href="/admin/posts" className="text-[0.84rem] text-ink-50 hover:text-ink">
          ← Articles
        </Link>
      </div>
      <p className="mt-3 max-w-[70ch] text-[0.9rem] leading-relaxed text-ink-50">
        Every live article, checked against the same rules: one keyword per page, the keyword in the
        title and the opening, links that resolve, at least two links out and one in, enough depth to
        rank. Worst first. Fix the red ones before writing anything new on the same topic.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          ["Live articles", audit.posts.length],
          ["High", audit.totals.high],
          ["Medium", audit.totals.medium],
          ["No issues", clean],
        ].map(([label, n]) => (
          <div key={label} className="rounded-2xl border border-ink-08 bg-paper p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-30">{label}</p>
            <p className="mt-2 text-[1.8rem] font-semibold leading-none tracking-[-0.04em]">{n}</p>
          </div>
        ))}
      </div>

      {audit.cannibalised.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[0.95rem] font-semibold">
            Competing articles ({audit.cannibalised.length})
          </h2>
          <p className="mt-1.5 max-w-[70ch] text-[0.84rem] leading-relaxed text-ink-50">
            Each group targets one search with more than one page, so Google splits it between them
            and neither ranks well. Keep the stronger one, fold the other&apos;s best parts into it,
            and give the weaker one a different keyword.
          </p>
          <ul className="mt-4 divide-y divide-ink-08 rounded-2xl border border-ink-08 bg-paper">
            {audit.cannibalised.map((g) => (
              <li key={g.keyword} className="px-5 py-3 text-[0.86rem]">
                <span className="font-medium">{g.keyword}</span>
                <span className="text-ink-30"> — </span>
                {g.slugs.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ", "}
                    <Link href={`/admin/posts/${s}`} className="underline underline-offset-2">
                      {s}
                    </Link>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[0.95rem] font-semibold">
            {showAll ? "All articles" : `Articles with issues (${list.length})`}
          </h2>
          <Link
            href={showAll ? "/admin/posts/seo" : "/admin/posts/seo?show=all"}
            className="text-[0.82rem] text-ink-50 hover:text-ink"
          >
            {showAll ? "Only with issues" : "Show all"}
          </Link>
        </div>
        {list.length === 0 ? (
          <div className="mt-4">
            <Empty>Nothing to fix.</Empty>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {list.map((p) => (
              <li key={p.slug} className="rounded-2xl border border-ink-08 bg-paper p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/posts/${p.slug}`}
                      className="text-[0.95rem] font-medium hover:underline"
                    >
                      {p.title}
                    </Link>
                    <p className="mt-0.5 text-[0.76rem] text-ink-30">
                      {p.category ?? "No category"} · “{p.focusKeyword || "no keyword"}” ·{" "}
                      {p.words.toLocaleString("en-IN")} words · {p.inbound} linking in ·{" "}
                      <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="underline">
                        view
                      </a>
                    </p>
                  </div>
                  <span className="text-[0.8rem] tabular-nums text-ink-50">{p.score}/100</span>
                </div>
                {p.issues.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {p.issues.map((i) => (
                      <li key={i.code} className="flex gap-2 text-[0.84rem] leading-snug">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[0.68rem] font-medium uppercase ${TONE[i.severity]}`}
                        >
                          {i.severity}
                        </span>
                        <span className="text-ink-70">{i.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
