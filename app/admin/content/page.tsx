import Link from "next/link";
import {
  getBanners, getBannerStats, getContentPerformance, getPostTitles, type ContentRow,
} from "@/lib/queries/admin";
import { BannerManager } from "@/components/admin/BannerManager";
import { RangePicker } from "@/components/admin/RangePicker";
import { resolveRange, rangeWords } from "@/lib/admin/range";
import { Empty, Panel, Stat, duration, num } from "@/components/admin/ui";

const KINDS = ["article", "tool", "listing", "page"] as const;

/**
 * Reading depth as a single glyph column. Numbers alone in a table of sixty
 * rows are unscannable; a filled proportion is read at a glance and the exact
 * figure is still there beside it.
 */
function Depth({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-ink-08">
        <span className="block h-full rounded-full bg-ink" style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      <span className="w-8 tabular-nums text-ink-50">{pct ? `${pct}%` : "—"}</span>
    </span>
  );
}

export default async function AdminContent({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string; from?: string; to?: string; kind?: string; sort?: string;
  }>;
}) {
  const sp = await searchParams;
  const range = resolveRange(sp);
  const days = range.days;
  const kind = (KINDS as readonly string[]).includes(sp.kind ?? "") ? sp.kind! : "article";
  const sort = ["views", "readers", "entries", "depth", "time", "cta"].includes(sp.sort ?? "")
    ? sp.sort!
    : "views";

  const [perf, banners, bannerStats] = await Promise.all([
    getContentPerformance(days, 200, range.from, range.to),
    getBanners(),
    getBannerStats(days),
  ]);
  const titles = await getPostTitles(perf.rows.map((r) => r.path));
  const statsById = Object.fromEntries(bannerStats.rows.map((r) => [r.id, r]));

  if (perf.error) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Content</h1>
        <div className="mt-8 rounded-2xl border border-ink-30 p-7">
          <p className="text-[0.95rem] font-medium">This screen needs one more SQL file</p>
          <p className="mt-2.5 max-w-[64ch] text-[0.9rem] leading-relaxed text-ink-50">
            Run <code>supabase/schemas/10_dashboard.sql</code> in the Supabase SQL Editor,
            then reload.
          </p>
          <p className="mt-4 font-mono text-[0.75rem] text-ink-30">{perf.error}</p>
        </div>
      </>
    );
  }

  const key = (r: ContentRow) =>
    sort === "readers" ? r.readers
      : sort === "entries" ? r.entries
      : sort === "depth" ? r.avg_scroll
      : sort === "time" ? r.avg_seconds
      : sort === "cta" ? r.cta_clicks
      : r.views;

  const rows = perf.rows.filter((r) => r.kind === kind).sort((a, b) => key(b) - key(a));

  const articles = perf.rows.filter((r) => r.kind === "article");
  const articleViews = articles.reduce((a, r) => a + r.views, 0);
  const withDepth = articles.filter((r) => r.avg_scroll > 0);
  const avgDepth = withDepth.length
    ? Math.round(withDepth.reduce((a, r) => a + r.avg_scroll, 0) / withDepth.length)
    : 0;

  // The two lists worth acting on: front doors, and pages nobody finishes.
  const doors = [...articles].sort((a, b) => b.entries - a.entries).filter((r) => r.entries > 0).slice(0, 6);
  const shallow = articles
    .filter((r) => r.views >= 5 && r.avg_scroll > 0 && r.avg_scroll < 45)
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  const link = (patch: Record<string, string | number>) => {
    const q = new URLSearchParams({ range: range.id, kind, sort });
    if (range.id === "custom" && sp.from && sp.to) { q.set("from", sp.from); q.set("to", sp.to); }
    for (const [k, v] of Object.entries(patch)) q.set(k, String(v));
    return `/admin/content?${q}`;
  };

  const Th = ({ id, children, right }: { id: string; children: React.ReactNode; right?: boolean }) => (
    <th className={`pb-3 pr-4 font-medium ${right ? "text-right" : "text-left"}`}>
      <Link
        href={link({ sort: id })}
        className={`underline-offset-4 hover:underline ${sort === id ? "text-ink" : ""}`}
      >
        {children}
        {sort === id && <span aria-hidden="true"> ↓</span>}
      </Link>
    </th>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Content</h1>
        <div className="flex flex-wrap items-center gap-3">
          <RangePicker basePath="/admin/content" range={range} />
          <Link
            href="/admin/posts/new"
            className="rounded-full bg-ink px-4 py-1.5 text-[0.8rem] font-medium text-paper"
          >
            New article
          </Link>
        </div>
      </div>

      <p className="mt-3 max-w-[72ch] text-[0.85rem] leading-relaxed text-ink-50">
        Which pages earn their place. Views tell you what gets opened; the depth and time
        columns tell you what gets read; <strong className="font-medium">landings</strong> tells
        you which pages search is actually sending people to. A page with high views but few
        landings is one your own readers click through to — a page with high landings is
        working in Google.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Articles with traffic" value={articles.length} hint={rangeWords(range)} />
        <Stat label="Article views" value={articleViews} />
        <Stat
          label="Average reading depth"
          value={avgDepth ? `${avgDepth}%` : "—"}
          hint="across articles with scroll data"
        />
        <Stat
          label="Tool CTA clicks"
          value={articles.reduce((a, r) => a + r.cta_clicks, 0)}
          hint="from inside articles"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Your front doors"
          note="Articles that most often start a session. These are the pages ranking in search — the ones worth refreshing first."
        >
          {doors.length === 0 ? (
            <Empty>No landing data yet.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {doors.map((r) => (
                <li key={r.path} className="flex items-baseline justify-between gap-4 text-[0.85rem]">
                  <Link href={r.path} className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                    {titles[r.path] ?? r.path}
                  </Link>
                  <span className="shrink-0 tabular-nums text-ink-50">{num(r.entries)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Opened but not read"
          note="Five or more views and under 45% average scroll. Either the opening does not deliver what the title promised, or the search intent is wrong."
        >
          {shallow.length === 0 ? (
            <Empty>
              Nothing is being abandoned early. Either the writing is landing, or there is not
              enough scroll data yet to tell.
            </Empty>
          ) : (
            <ul className="space-y-2.5">
              {shallow.map((r) => (
                <li key={r.path} className="flex items-baseline justify-between gap-4 text-[0.85rem]">
                  <Link href={r.path} className="min-w-0 flex-1 truncate underline-offset-4 hover:underline">
                    {titles[r.path] ?? r.path}
                  </Link>
                  <span className="shrink-0 tabular-nums text-ink-30">
                    {r.avg_scroll}% · {num(r.views)} views
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Link
            key={k}
            href={link({ kind: k })}
            className={`rounded-full px-4 py-1.5 text-[0.8rem] capitalize ${
              kind === k ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
            }`}
          >
            {k === "listing" ? "Listings" : `${k}s`}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[880px] text-[0.85rem]">
          <thead>
            <tr className="border-b border-ink-15 text-[0.72rem] uppercase tracking-wider text-ink-30">
              <th className="pb-3 pr-4 text-left font-medium">Page</th>
              <Th id="views" right>Views</Th>
              <Th id="readers" right>People</Th>
              <Th id="entries" right>Landings</Th>
              <Th id="depth">Depth</Th>
              <Th id="time" right>Time</Th>
              <Th id="cta" right>CTA</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-08">
            {rows.map((r) => (
              <tr key={r.path}>
                <td className="max-w-[380px] py-3 pr-4">
                  <Link href={r.path} className="line-clamp-1 underline-offset-4 hover:underline">
                    {titles[r.path] ?? r.path}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-right font-medium tabular-nums">{num(r.views)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-50">{num(r.readers)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-50">{num(r.entries)}</td>
                <td className="py-3 pr-4"><Depth pct={r.avg_scroll} /></td>
                <td className="py-3 pr-4 text-right tabular-nums text-ink-50">
                  {duration(r.avg_seconds)}
                </td>
                <td className="py-3 text-right tabular-nums text-ink-50">
                  {r.cta_clicks || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="mt-6 text-[0.9rem] text-ink-50">
            Nothing in this window yet. Traffic has to arrive before this table has anything to say.
          </p>
        )}
      </div>

      <div className="mt-16 border-t border-ink-08 pt-10">
        {banners.ready ? (
          <BannerManager banners={banners.rows} stats={statsById} />
        ) : (
          <>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">Promotional banners</h2>
            <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
              Run <code className="font-mono text-ink">supabase/schemas/11_authoring.sql</code> in
              the Supabase SQL editor to switch this on. It creates the banners table and the
              storage bucket for images.
            </p>
          </>
        )}
      </div>
    </>
  );
}
