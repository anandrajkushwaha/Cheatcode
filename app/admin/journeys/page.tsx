import Link from "next/link";
import { Panel, Empty } from "@/components/admin/ui";
import { getJourneys, STEPS, type Breakdown, type SourceFilter } from "@/lib/admin/journeys";
import { rangeQuery, resolveRange, type Range } from "@/lib/admin/range";

export const dynamic = "force-dynamic";

/**
 * Journeys: who came from an ad, how far each one got, and where they left.
 *
 * Three things, top to bottom, and nothing else: the funnel, what the visits
 * were on (browser, phone, city), and the visits themselves — each one opens
 * to show every page and step in order. Two rows of pills choose the period
 * and the source; there are no other controls on purpose.
 */

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "28d", label: "28 days" },
] as const;

const SOURCES: { id: SourceFilter; label: string }[] = [
  { id: "meta", label: "Meta (Instagram / Facebook)" },
  { id: "paid", label: "All ads" },
  { id: "all", label: "Everyone" },
];

const OUTCOME = [
  "Left on the first page",
  "Saw sign-up, left",
  "Entered number, left",
  "Signed in",
  "Used ATS / resume",
];

const TIME = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

function duration(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function offset(from: string, at: string) {
  return `+${duration(Math.max(0, Math.round((Date.parse(at) - Date.parse(from)) / 1000)))}`;
}

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
  const src: SourceFilter = sp.src === "paid" || sp.src === "all" ? sp.src : "meta";
  const result = await getJourneys(range, src);

  const link = (r: Range | string, s: SourceFilter) =>
    `/admin/journeys?${typeof r === "string" ? rangeQuery({ ...range, id: r as Range["id"] }, { src: s }) : rangeQuery(r, { src: s })}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Journeys</h1>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Every visit, step by step — how many reached each screen, and where the rest left.
          Signed in or not. Your own devices and bots are not counted.
        </p>
        <div className="mt-5 space-y-2.5">
          <Pills items={PERIODS} active={range.id as (typeof PERIODS)[number]["id"]} href={(id) => link(id, src)} />
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

          {/* ------------------------------------------------- breakdowns */}
          <div className="grid gap-4 lg:grid-cols-3">
            <BreakdownTable title="Browser" rows={result.data.byBrowser} />
            <BreakdownTable title="Phone" rows={result.data.byOs} />
            <BreakdownTable title="City" rows={result.data.byCity} />
          </div>

          {/* --------------------------------------------------- visits */}
          <Panel
            title="Visits"
            note={`${result.data.total} visit${result.data.total === 1 ? "" : "s"}${
              result.data.total > result.data.journeys.length ? `, latest ${result.data.journeys.length} shown` : ""
            }${result.data.crawlers ? `. ${result.data.crawlers} more from Meta / cloud data centres (ad review bots) are hidden` : ""}${
              result.data.truncated ? " (busiest period trimmed — pick a shorter one)" : ""
            }. Tap one to see every step.`}
          >
            {result.data.journeys.length === 0 ? (
              <Empty>No visits from this source in this period.</Empty>
            ) : (
              <ul className="divide-y divide-ink-08">
                {result.data.journeys.map((j) => (
                  <li key={j.session}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 py-3 text-[0.84rem]">
                        <span className="w-[7.5rem] shrink-0 text-ink-50 tabular-nums">{TIME.format(new Date(j.startedAt))}</span>
                        <span className="min-w-[7rem]">{j.city ?? "Unknown city"}</span>
                        <span className="text-ink-50">
                          {j.os ?? "?"} · {j.browser ?? "?"}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[0.72rem] ${
                            j.furthest >= 3 ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
                          }`}
                        >
                          {OUTCOME[j.furthest]}
                        </span>
                        <span className="ml-auto text-[0.75rem] text-ink-30 tabular-nums">
                          {j.pages} page{j.pages === 1 ? "" : "s"} · {duration(j.seconds)}
                        </span>
                      </summary>
                      <div className="mb-4 rounded-xl bg-ink-04 p-4 text-[0.8rem]">
                        <p className="text-ink-50">
                          {j.source ?? "unknown source"}
                          {j.campaign ? ` · ${j.campaign}` : ""} · {j.device ?? "?"} · landed on {j.landing}
                        </p>
                        <ol className="mt-3 space-y-1.5">
                          {j.timeline.map((t, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="w-14 shrink-0 text-right text-ink-30 tabular-nums">{offset(j.startedAt, t.at)}</span>
                              <span className={t.kind === "page" ? "text-ink-50" : "font-medium"}>
                                {t.kind === "page" ? `Opened ${t.text}` : t.text}
                              </span>
                            </li>
                          ))}
                        </ol>
                        <p className="mt-3 text-[0.72rem] text-ink-30">
                          Steps reached: {j.reached.map((i) => STEPS[i]).join(" → ")}
                        </p>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
