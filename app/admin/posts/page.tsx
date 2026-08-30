import Link from "next/link";
import {
  getAdminPosts, getAdminStats, getViewsByPath, type ContentRow,
} from "@/lib/queries/admin";
import { formatDate } from "@/components/content/bits";
import { RangePicker } from "@/components/admin/RangePicker";
import { resolveRange, rangeWords } from "@/lib/admin/range";
import { Empty, duration, num } from "@/components/admin/ui";

type Row = {
  id: string; slug: string; title: string; post_type: string;
  status: string; published_at: string; word_count: number | null;
  quality_score: number | null; focus_keyword?: string | null;
  category?: { name: string } | null;
};

const SORTS = {
  views: "Views",
  readers: "People",
  date: "Published",
  depth: "Depth",
  words: "Words",
  quality: "Score",
} as const;
type SortId = keyof typeof SORTS;

export default async function AdminPosts({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string; from?: string; to?: string;
    sort?: string; cat?: string; state?: string; q?: string;
  }>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp);
  const sort: SortId = (Object.keys(SORTS) as SortId[]).includes(sp.sort as SortId)
    ? (sp.sort as SortId)
    : "views";
  const state = ["live", "scheduled", "draft"].includes(sp.state ?? "") ? sp.state! : "all";
  const query = (sp.q ?? "").trim().toLowerCase();

  const [posts, stats, byPath] = await Promise.all([
    getAdminPosts(500),
    getAdminStats(),
    getViewsByPath(range.days),
  ]);

  const now = new Date().toISOString();
  const traffic = (slug: string): ContentRow | undefined => byPath[`/blog/${slug}`];

  let rows = (posts as unknown as Row[]).map((p) => {
    const t = traffic(p.slug);
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      published_at: p.published_at,
      word_count: p.word_count,
      quality_score: p.quality_score,
      focus_keyword: p.focus_keyword ?? null,
      categoryName: p.category?.name ?? null,
      views: t?.views ?? 0,
      readers: t?.readers ?? 0,
      entries: t?.entries ?? 0,
      depth: t?.avg_scroll ?? 0,
      seconds: t?.avg_seconds ?? 0,
      scheduled: p.published_at > now,
    };
  });

  if (sp.cat) rows = rows.filter((r) => r.categoryName === sp.cat);
  if (state === "live") rows = rows.filter((r) => !r.scheduled && r.status !== "draft");
  if (state === "scheduled") rows = rows.filter((r) => r.scheduled);
  if (state === "draft") rows = rows.filter((r) => r.status === "draft");
  if (query) {
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.slug.includes(query) ||
        (r.focus_keyword ?? "").toLowerCase().includes(query),
    );
  }

  rows.sort((a, b) => {
    switch (sort) {
      case "readers": return b.readers - a.readers;
      case "date": return b.published_at.localeCompare(a.published_at);
      case "depth": return b.depth - a.depth;
      case "words": return (b.word_count ?? 0) - (a.word_count ?? 0);
      case "quality": return (b.quality_score ?? 0) - (a.quality_score ?? 0);
      default: return b.views - a.views || b.published_at.localeCompare(a.published_at);
    }
  });

  const link = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ range: range.id, sort });
    if (state !== "all") q.set("state", state);
    if (range.id === "custom" && sp.from && sp.to) { q.set("from", sp.from); q.set("to", sp.to); }
    if (sp.cat) q.set("cat", sp.cat);
    if (query) q.set("q", query);
    for (const [k, v] of Object.entries(patch)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    return `/admin/posts?${q}`;
  };

  const Th = ({ id, children }: { id: SortId; children: React.ReactNode }) => (
    <th className="pb-3 pr-4 text-right font-medium">
      <Link
        href={link({ sort: id })}
        className={`underline-offset-4 hover:underline ${sort === id ? "text-ink" : ""}`}
      >
        {children}
        {sort === id && <span aria-hidden="true"> ↓</span>}
      </Link>
    </th>
  );

  const totalViews = rows.reduce((a, r) => a + r.views, 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Articles</h1>
        <div className="flex flex-wrap items-center gap-3">
          <RangePicker basePath="/admin/posts" range={range} />
          <Link
            href="/admin/posts/new"
            className="rounded-full bg-ink px-4 py-1.5 text-[0.8rem] font-medium text-paper"
          >
            New article
          </Link>
        </div>
      </div>

      <p className="mt-3 max-w-[72ch] text-[0.85rem] leading-relaxed text-ink-50">
        Every article with its traffic over {rangeWords(range)}. Sort by any column: views is what
        gets opened, <strong className="font-medium">landings</strong> is what search sends people
        to, and depth is whether they stayed once they arrived.
      </p>

      {/* --------------------------------------------------------- filters */}
      <div className="mt-7 flex flex-wrap items-center gap-2">
        {([["all", "All"], ["live", "Live"], ["scheduled", "Scheduled"], ["draft", "Drafts"]] as const).map(
          ([id, label]) => (
            <Link
              key={id}
              href={link({ state: id === "all" ? "" : id })}
              className={`rounded-full px-3.5 py-1.5 text-[0.78rem] ${
                state === id ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
              }`}
            >
              {label}
            </Link>
          ),
        )}

        <span aria-hidden="true" className="mx-1 h-4 w-px bg-ink-15" />

        <Link
          href={link({ cat: "" })}
          className={`rounded-full px-3.5 py-1.5 text-[0.78rem] ${
            !sp.cat ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
          }`}
        >
          Every topic
        </Link>
        {stats.byCategory
          .filter((c) => c.count > 0)
          .map((c) => (
            <Link
              key={c.slug}
              href={link({ cat: c.name })}
              className={`rounded-full px-3.5 py-1.5 text-[0.78rem] ${
                sp.cat === c.name ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
              }`}
            >
              {c.name}
            </Link>
          ))}
      </div>

      <form action="/admin/posts" className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="range" value={range.id} />
        <input type="hidden" name="sort" value={sort} />
        {state !== "all" && <input type="hidden" name="state" value={state} />}
        {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search title, slug or focus keyword"
          className="w-full max-w-sm rounded-full border border-ink-15 px-4 py-1.5 text-[0.82rem] outline-none focus:border-ink-30"
        />
        <button
          type="submit"
          className="rounded-full border border-ink-15 px-4 py-1.5 text-[0.8rem] text-ink-50"
        >
          Search
        </button>
        {query && (
          <Link
            href={link({ q: "" })}
            className="self-center text-[0.8rem] text-ink-30 underline underline-offset-4"
          >
            clear
          </Link>
        )}
      </form>

      <p className="mt-5 text-[0.8rem] text-ink-30">
        {num(rows.length)} article{rows.length === 1 ? "" : "s"} · {num(totalViews)} views in this window
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[960px] text-[0.85rem]">
          <thead>
            <tr className="border-b border-ink-15 text-[0.72rem] uppercase tracking-wider text-ink-30">
              <th className="pb-3 pr-4 text-left font-medium">Title</th>
              <th className="pb-3 pr-4 text-left font-medium">Topic</th>
              <Th id="views">Views</Th>
              <Th id="readers">People</Th>
              <th className="pb-3 pr-4 text-right font-medium">Landings</th>
              <Th id="depth">Depth</Th>
              <th className="pb-3 pr-4 text-right font-medium">Time</th>
              <Th id="date">Published</Th>
              <Th id="words">Words</Th>
              <Th id="quality">Score</Th>
              <th className="pb-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-08">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="max-w-[300px] py-3 pr-4">
                  <Link href={`/blog/${p.slug}`} className="line-clamp-1 underline-offset-4 hover:underline">
                    {p.title}
                  </Link>
                  {(p.scheduled || p.status === "draft") && (
                    <span className="mt-1 inline-block rounded-full border border-ink-15 px-2 py-0.5 text-[0.68rem] text-ink-50">
                      {p.status === "draft" ? "draft" : "scheduled"}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-ink-50">{p.categoryName ?? "—"}</td>
                <td className="py-3 pr-4 text-right font-medium tabular-nums">{p.views || "—"}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-50">{p.readers || "—"}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-50">{p.entries || "—"}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-50">
                  {p.depth ? `${p.depth}%` : "—"}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-50">{duration(p.seconds)}</td>
                <td className="whitespace-nowrap py-3 pr-4 text-right text-ink-50">
                  {formatDate(p.published_at)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-30">{num(p.word_count ?? 0)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-30">{p.quality_score}</td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/posts/${p.slug}`}
                    className="text-[0.8rem] text-ink-30 underline underline-offset-4 hover:text-ink"
                  >
                    edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="mt-6">
            <Empty>Nothing matches those filters.</Empty>
          </div>
        )}
      </div>
    </>
  );
}
