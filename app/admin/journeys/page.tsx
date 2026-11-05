import Link from "next/link";
import { Panel, Empty } from "@/components/admin/ui";
import { JourneyTable } from "@/components/admin/JourneyTable";
import { LiveCount } from "@/components/admin/LiveCount";
import { LIVE_MINUTES, getLive } from "@/lib/admin/live";
import { getJourneys, STEPS, type Breakdown, type SourceFilter } from "@/lib/admin/journeys";
import { rangeQuery, resolveRange, type Range } from "@/lib/admin/range";
import { RangePicker } from "@/components/admin/RangePicker";

export const dynamic = "force-dynamic";

/**
 * Journeys: who came from an ad, how far each one got, and where they left.
 *
 * Three things, top to bottom, and nothing else: the funnel, the visits
 * themselves as a sheet with a filter on every column
 * (components/admin/JourneyTable.tsx) — each row opens to show every page
 * and step in order — and what the visits were on (browser, phone, city). Two rows of pills choose the
 * period and the source; it opens on the last 7 days and everyone.
 */

const SOURCES: { id: SourceFilter; label: string }[] = [
  { id: "meta", label: "Meta (Instagram / Facebook)" },
  { id: "paid", label: "All ads" },
  { id: "all", label: "Everyone" },
];

const OUTCOME = [
  "Left on the first page",
  "Saw sign-up form, left",
  "Entered number, left",
  "Signed in",
  "Used ATS / resume",
];

function Pills<T extends string>({
  items,
  active,
  href,
}: {
  items: readonly { id: T; label: string }[];
  active: T;
  href: (id: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Link
          key={i.id}
          href={href(i.id)}
          className={`rounded-full px-3.5 py-1.5 text-[0.8rem] transition-colors ${
            i.id === active ? "bg-ink text-paper" : "border border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: Breakdown }) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <Empty>No visits.</Empty>
      ) : (
        <table className="w-full text-[0.84rem] tabular-nums">
          <thead>
            <tr className="text-left text-[0.68rem] uppercase tracking-[0.12em] text-ink-30">
              <th className="pb-2 font-medium" />
              <th className="pb-2 text-right font-medium">Visits</th>
              <th className="pb-2 text-right font-medium">Signed in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-ink-08">
                <td className="max-w-[10rem] truncate py-2 pr-2">{r.key}</td>
                <td className="py-2 text-right text-ink-50">{r.visits}</td>
                <td className="py-2 text-right">
                  {r.signedIn}
                  <span className="ml-1 text-[0.72rem] text-ink-30">
                    {r.visits ? `${Math.round((r.signedIn / r.visits) * 100)}%` : ""}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export default async function AdminJourneys({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; src?: string }>;
}) {
  const sp = await searchParams;
  const range: Range = resolveRange({ ...sp, range: sp.range ?? "7d" });
  const src: SourceFilter = sp.src === "paid" || sp.src === "meta" ? sp.src : "all";
  const [result, liveRes] = await Promise.all([getJourneys(range, src), getLive()]);
  const live = liveRes.ok ? { count: liveRes.count, sessions: liveRes.sessions } : null;

  const link = (r: Range | string, s: SourceFilter) =>
    `/admin/journeys?${typeof r === "string" ? rangeQuery({ ...range, id: r as Range["id"] }, { src: s }) : rangeQuery(r, { src: s })}`;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Activity</h1>
          <LiveCount initial={live} minutes={LIVE_MINUTES} />
        </div>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Every visit, step by step — how many reached each screen, and where the rest left.
          Signed in or not. Your own devices and bots are not counted.
        </p>
        <div className="mt-5 space-y-2.5">
          <RangePicker basePath="/admin/journeys" range={range} keep={{ src }} />
          <Pills items={SOURCES} active={src} href={(id) => link(range, id)} />
        </div>
      </div>

      {!result.ok ? (
        <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          Couldn&apos;t read analytics: {result.error}
        </p>
      ) : (
        <>
          {/* ---------------------------------------------------- funnel */}
          <Panel
            title="Funnel"
            note="Visits that did each step. The free ATS page gives a score without sign-up, so the last step can be bigger than the ones before it."
          >
            <div className="grid gap-3 sm:grid-cols-5">
              {result.data.funnel.map((f, i) => {
                const top = result.data.funnel[0].visits || 1;
                const prev = i > 0 ? result.data.funnel[i - 1].visits : null;
                return (
                  <div key={f.step} className="rounded-xl border border-ink-08 p-4">
                    <p className="text-[0.72rem] leading-snug text-ink-50">
                      {i + 1}. {f.step}
                    </p>
                    <p className="mt-2 text-[1.7rem] font-semibold leading-none tracking-[-0.04em] tabular-nums">
                      {f.visits}
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-04">
                      <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, (f.visits / top) * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-[0.72rem] text-ink-30 tabular-nums">
                      {Math.round((f.visits / top) * 100)}% of visits
                      {prev !== null && prev > f.visits ? ` · ${prev - f.visits} left before this` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* --------------------------------------------------- visits */}
          <Panel
            title="Visits"
            note={`${result.data.total} visit${result.data.total === 1 ? "" : "s"}${
              result.data.total > result.data.journeys.length ? `, latest ${result.data.journeys.length} shown` : ""
            }${result.data.crawlers ? `. ${result.data.crawlers} more from bots are hidden (cloud data centres, Meta ad review, and one-page visits that sent nothing)` : ""}${
              result.data.truncated ? " (busiest period trimmed — pick a shorter one)" : ""
            }. Filter any column from its header; tap a row to see every step.`}
          >
            {result.data.journeys.length === 0 ? (
              <Empty>No visits from this source in this period.</Empty>
            ) : (
              <JourneyTable journeys={result.data.journeys} steps={[...STEPS]} outcomes={OUTCOME} initialLive={live} />
            )}
          </Panel>

          {/* ------------------------------------------------- breakdowns */}
          <div className="grid gap-4 lg:grid-cols-3">
            <BreakdownTable title="Browser" rows={result.data.byBrowser} />
            <BreakdownTable title="Phone" rows={result.data.byOs} />
            <BreakdownTable title="City" rows={result.data.byCity} />
          </div>

        </>
      )}
    </div>
  );
}
