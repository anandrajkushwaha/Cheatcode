import { RangePicker } from "@/components/admin/RangePicker";
import { PageTable } from "@/components/admin/PageTable";
import { Empty, Panel, Stat, num } from "@/components/admin/ui";
import { resolveRange, rangeWords } from "@/lib/admin/range";
import { getPages } from "@/lib/admin/pages";

export const dynamic = "force-dynamic";

/**
 * Every page, including the ones nobody opened.
 *
 * Traffic answers "how many came and from where". This answers the question
 * underneath it — which of the things we have actually published are being
 * read, and which are sitting there costing nothing and returning nothing.
 * The second half of that cannot come out of the analytics tables on their
 * own, so the list of pages is built from the posts, banks, insights and
 * routes themselves, and the visits are matched onto it.
 */
export default async function AdminPages({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const range = resolveRange(await searchParams);
  const result = await getPages(range);

  if (!result.ok) {
    return (
      <div className="rounded-xl border border-ink-15 px-5 py-4 text-[0.85rem] leading-relaxed text-ink-50">
        {result.error}
      </div>
    );
  }

  const d = result.data;
  const readable = d.articles.filter((a) => a.readThrough != null);
  const avgRead = readable.length
    ? Math.round(readable.reduce((s, a) => s + (a.readThrough ?? 0), 0) / readable.length)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-[-0.03em]">Pages</h1>
          <p className="mt-1 text-[0.85rem] text-ink-50">
            What is being read {rangeWords(range)} — and what is not.
          </p>
        </div>
        <RangePicker basePath="/admin/pages" range={range} />
      </div>

      {d.truncated && (
        <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.8rem] text-ink-50">
          This window holds more visits than one read returns, so the numbers below are a floor
          rather than a total. Narrow the range for exact figures.
        </p>
      )}

      <Panel
        title="At a glance"
        note="A page counts as never opened when nothing was recorded for it in this window. Drafts are left out of that count."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Pages we have" value={num(d.totals.pages)} />
          <Stat
            label="Opened at least once"
            value={num(d.totals.withViews)}
            hint={
              d.totals.pages
                ? `${Math.round((d.totals.withViews / d.totals.pages) * 100)}% of the site`
                : undefined
            }
          />
          <Stat label="Never opened" value={num(d.totals.withoutViews)} hint="published, no visits" />
          <Stat
            label="Shares"
            value={num(d.totals.shares)}
            hint={avgRead == null ? undefined : `articles read to ${avgRead}% on average`}
          />
        </div>
      </Panel>

      <Panel
        title="Articles"
        note="Read is the average furthest scroll — a high view count with a low Read is a headline that worked and a piece that did not."
        action={{ label: "Write one", href: "/admin/posts" }}
      >
        <PageTable rows={d.articles} emptyLabel="No articles published yet." />
      </Panel>

      {d.insights.length > 0 && (
        <Panel title="Insights" action={{ label: "Publish one", href: "/admin/insights" }}>
          <PageTable rows={d.insights} emptyLabel="No insights published yet." />
        </Panel>
      )}

      <Panel
        title="Everything else"
        note="The landing pages, free tools, question banks and the signed-in app screens."
      >
        <PageTable rows={d.pages} emptyLabel="Nothing here yet." showGroup />
      </Panel>

      <Panel
        title="Nobody opened these"
        note="Published and live, and not visited once in this window. Worth either promoting or retiring."
      >
        {d.unseen.length === 0 ? (
          <Empty>Every published page got at least one visit in this window.</Empty>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {d.unseen.slice(0, 60).map((p) => (
              <li key={p.path} className="min-w-0">
                <a
                  href={p.path}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-[0.82rem] underline-offset-4 hover:underline"
                  title={p.path}
                >
                  {p.title}
                </a>
                <span className="block truncate text-[0.72rem] text-ink-30">
                  {p.group} · {p.path}
                </span>
              </li>
            ))}
            {d.unseen.length > 60 && (
              <li className="text-[0.78rem] text-ink-30">
                …and {num(d.unseen.length - 60)} more. The Articles and Everything else tables above
                have a &ldquo;Never opened&rdquo; filter with the full list.
              </li>
            )}
          </ul>
        )}
      </Panel>
    </div>
  );
}
