import Link from "next/link";
import { getAnalytics, getEvents } from "@/lib/queries/admin";

const RANGES = [1, 7, 30, 90];

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink-08 p-6">
      <p className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-30">{label}</p>
      <p className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.04em]">
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
      {hint && <p className="mt-2 text-[0.78rem] text-ink-30">{hint}</p>}
    </div>
  );
}

function BarList({
  title,
  rows,
  emptyNote,
}: {
  title: string;
  rows: { label: string; value: number; href?: string }[];
  emptyNote: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-[0.85rem] text-ink-30">{emptyNote}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3">
              <span className="w-[46%] shrink-0 truncate text-[0.85rem]">
                {r.href ? (
                  <Link href={r.href} className="underline-offset-4 hover:underline">
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-08">
                <span
                  className="block h-full rounded-full bg-ink"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right text-[0.8rem] tabular-nums text-ink-50">
                {r.value.toLocaleString("en-IN")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AdminAnalytics({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = RANGES.includes(Number(daysParam)) ? Number(daysParam) : 7;
  const [a, ev] = await Promise.all([getAnalytics(days), getEvents(days)]);

  if (a.error) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Traffic</h1>
        <div className="mt-8 rounded-2xl border border-ink-30 p-7">
          <p className="text-[0.95rem] font-medium">Tracking isn&apos;t set up yet</p>
          <p className="mt-2.5 max-w-[64ch] text-[0.9rem] leading-relaxed text-ink-50">
            Run <code>supabase/schemas/05_analytics.sql</code> in the Supabase SQL Editor,
            then reload this page. It creates the <code>page_views</code> table and the
            aggregation function this screen reads.
          </p>
          <p className="mt-4 font-mono text-[0.75rem] text-ink-30">{a.error}</p>
        </div>
      </>
    );
  }

  const maxDaily = Math.max(1, ...a.daily.map((d) => d.views));

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Traffic</h1>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/analytics?days=${r}`}
              className={`rounded-full px-3.5 py-1.5 text-[0.78rem] ${
                days === r ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
              }`}
            >
              {r === 1 ? "24h" : `${r}d`}
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-3 max-w-[68ch] text-[0.85rem] leading-relaxed text-ink-50">
        First-party tracking, alongside Google Analytics. Bots, headless browsers and
        your own admin browsing are excluded before anything is counted
        {ev.bots_blocked > 0
          ? ` — ${ev.bots_blocked.toLocaleString("en-IN")} automated hit${ev.bots_blocked === 1 ? "" : "s"} filtered in this window.`
          : "."}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Unique users"
          value={a.unique_users}
          hint="distinct people, across sessions"
        />
        <Stat
          label="Sessions"
          value={a.visitors}
          hint={`last ${days === 1 ? "24 hours" : `${days} days`}`}
        />
        <Stat
          label="Page views"
          value={a.views}
          hint={`${a.visitors > 0 ? (a.views / a.visitors).toFixed(1) : "0"} per session`}
        />
        <Stat
          label="Today"
          value={a.users_today}
          hint={`${a.visitors_today} sessions · ${a.views_today.toLocaleString("en-IN")} views · IST`}
        />
        <Stat label="All time users" value={a.users_all_time} />
        <Stat label="All time views" value={a.views_all_time} />
      </div>

      {a.daily.length > 0 && (
        <div className="mt-12">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Views per day
          </h2>
          <div className="mt-5 flex items-end gap-1.5" style={{ height: 140 }}>
            {a.daily.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-ink transition-opacity group-hover:opacity-70"
                    style={{ height: `${Math.max(2, (d.views / maxDaily) * 100)}%` }}
                    title={`${d.day}: ${d.users} users · ${d.visitors} sessions · ${d.views} views`}
                  />
                </div>
                <span className="text-[0.62rem] text-ink-30">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <BarList
          title="Where visitors came from"
          rows={a.top_sources.map((s) => ({ label: s.source, value: s.views }))}
          emptyNote="No traffic recorded yet."
        />
        <BarList
          title="Most visited pages"
          rows={a.top_pages.map((p) => ({ label: p.path, value: p.views, href: p.path }))}
          emptyNote="No page views recorded yet."
        />
        <BarList
          title="Cities"
          rows={a.top_cities.map((c) => ({
            label: c.country ? `${c.city} · ${c.country}` : c.city,
            value: c.views,
          }))}
          emptyNote="City data appears once the site is visited through Vercel."
        />
        <BarList
          title="Countries"
          rows={a.top_countries.map((c) => ({ label: c.country, value: c.views }))}
          emptyNote="Country data appears once the site is visited through Vercel."
        />
        <BarList
          title="Platform"
          rows={a.top_os.map((o) => ({
            label: `${o.os}${o.users ? ` · ${o.users} user${o.users === 1 ? "" : "s"}` : ""}`,
            value: o.views,
          }))}
          emptyNote="No data yet."
        />
        <BarList
          title="Browser"
          rows={a.top_browsers.map((b) => ({
            label: `${b.browser}${b.users ? ` · ${b.users} user${b.users === 1 ? "" : "s"}` : ""}`,
            value: b.views,
          }))}
          emptyNote="No data yet."
        />
        <BarList
          title="Device type"
          rows={a.devices.map((d) => ({ label: d.device, value: d.views }))}
          emptyNote="No data yet."
        />
      </div>

      {!ev.error && (
        <>
          <div className="mt-16">
            <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
              Conversion funnel (unique sessions)
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Sessions", ev.funnel.sessions],
                ["Saw a CTA", ev.funnel.cta_view],
                ["Clicked a CTA", ev.funnel.cta_click],
                ["Started typing", ev.funnel.waitlist_start],
                ["Submitted", ev.funnel.waitlist_submit],
                ["Joined", ev.funnel.waitlist_success],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-2xl border border-ink-08 p-5">
                  <p className="text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">{label}</p>
                  <p className="mt-2 text-[1.6rem] font-semibold leading-none tracking-[-0.04em]">
                    {((n as number) ?? 0).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 grid gap-12 lg:grid-cols-2">
            <BarList
              title="Events"
              rows={ev.by_event.map((e) => ({ label: e.event, value: e.count }))}
              emptyNote="No events recorded yet."
            />
            <BarList
              title="Which CTAs get clicked"
              rows={ev.top_ctas.map((c) => ({
                label: c.label ? `${c.location} — ${c.label}` : c.location,
                value: c.count,
              }))}
              emptyNote="No CTA clicks yet."
            />
          </div>
        </>
      )}
    </>
  );
}
