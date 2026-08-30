import { getAnalytics, getEvents, getPostTitles } from "@/lib/queries/admin";
import { DeviceExclusion } from "@/components/admin/DeviceExclusion";
import { RangePicker } from "@/components/admin/RangePicker";
import { StaleSchemaNotice } from "@/components/admin/StaleSchemaNotice";
import { resolveRange, rangeWords } from "@/lib/admin/range";
import { funnelSteps } from "@/lib/admin/funnel";
import {
  BarList, Empty, FunnelChart, Panel, SplitBar, Stat, TrendChart, duration, num, rupees,
} from "@/components/admin/ui";

export default async function AdminAnalytics({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const range = resolveRange(await searchParams);
  const days = range.days;
  const [a, ev] = await Promise.all([
    getAnalytics(days, range.from, range.to),
    getEvents(days, range.from, range.to),
  ]);

  if (a.error) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Traffic</h1>
        <div className="mt-8 rounded-2xl border border-ink-30 p-7">
          <p className="text-[0.95rem] font-medium">Tracking isn&apos;t set up yet</p>
          <p className="mt-2.5 max-w-[64ch] text-[0.9rem] leading-relaxed text-ink-50">
            Run the files in <code>supabase/schemas/</code> in order, ending with{" "}
            <code>10_dashboard.sql</code>, in the Supabase SQL Editor. They create the
            tables and the aggregation functions this screen reads.
          </p>
          <p className="mt-4 font-mono text-[0.75rem] text-ink-30">{a.error}</p>
        </div>
      </>
    );
  }

  const titles = await getPostTitles([
    ...a.entry_pages.map((p) => p.path),
    ...a.top_pages.map((p) => p.path),
  ]);
  const label = (path: string) => titles[path] ?? path;

  const window = rangeWords(range);
  const bounceRate = a.sessions_total
    ? Math.round((a.sessions_bounced / a.sessions_total) * 100)
    : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Traffic</h1>
        <RangePicker basePath="/admin/analytics" range={range} />
      </div>

      <p className="mt-3 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
        First-party tracking, alongside Google Analytics. Bots, headless browsers and your own
        traffic are excluded before anything is counted
        {a.bots_blocked > 0
          ? ` — ${num(a.bots_blocked)} automated hit${a.bots_blocked === 1 ? "" : "s"} filtered in this window.`
          : "."}{" "}
        Every headline number is compared with the equivalent period immediately before
        this window.
      </p>

      <StaleSchemaNotice stale={a.stale || ev.stale} />

      <DeviceExclusion excludedDevices={a.excluded_devices} />

      {/* ------------------------------------------------------- headline */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="People" value={a.unique_users} now={a.unique_users} before={a.prev_users} />
        <Stat label="Sessions" value={a.visitors} now={a.visitors} before={a.prev_visitors} />
        <Stat label="Page views" value={a.views} now={a.views} before={a.prev_views} />
        <Stat
          label="Pages per session"
          value={a.views_per_session === null ? "—" : a.views_per_session.toFixed(2)}
          hint={bounceRate === null ? undefined : `${bounceRate}% saw only one page`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Today so far" value={a.users_today} hint={`${num(a.views_today)} views · IST`} />
        <Stat label="All-time people" value={a.users_all_time} hint="since tracking began" />
        <Stat label="All-time views" value={a.views_all_time} hint="since tracking began" />
        <Stat
          label="Median time on page"
          value={duration(ev.engagement.median_seconds)}
          hint={`average ${duration(ev.engagement.avg_seconds)}`}
        />
      </div>

      {/* ---------------------------------------------------------- trend */}
      <div className="mt-4">
        <Panel title={`Views and people per day · ${window}`}>
          <TrendChart points={a.daily} />
        </Panel>
      </div>

      {/* -------------------------------------------------------- acquisition */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Where visitors came from">
          <BarList
            rows={a.top_sources.map((s) => ({
              label: s.source,
              value: s.views,
              sub: s.users ? `${num(s.users)} people` : undefined,
            }))}
            empty="No traffic recorded yet."
          />
        </Panel>

        <Panel
          title="Landing pages"
          note="The page that opened the session. This is what search actually ranks."
          action={{ label: "By article", href: "/admin/content" }}
        >
          <BarList
            rows={a.entry_pages.map((p) => ({ label: label(p.path), value: p.views, href: p.path }))}
            empty="No sessions recorded yet."
          />
        </Panel>

        <Panel title="Most visited pages">
          <BarList
            rows={a.top_pages.map((p) => ({
              label: label(p.path),
              value: p.views,
              sub: p.users ? `${num(p.users)} people` : undefined,
              href: p.path,
            }))}
            empty="No page views recorded yet."
          />
        </Panel>

        <Panel title="New vs returning" note={`People seen in ${window}.`}>
          <SplitBar
            parts={[
              { label: "First time here", value: a.new_users },
              { label: "Been here before", value: a.returning_users },
            ]}
          />
        </Panel>
      </div>

      {/* -------------------------------------------------------- audience */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Cities">
          <BarList
            rows={a.top_cities.map((c) => ({
              label: c.country ? `${c.city} · ${c.country}` : c.city,
              value: c.views,
            }))}
            empty="City data needs Cloudflare's visitor location headers switched on."
          />
        </Panel>
        <Panel title="Countries">
          <BarList
            rows={a.top_countries.map((c) => ({ label: c.country, value: c.views }))}
            empty="No country data yet."
          />
        </Panel>
        <Panel title="Device">
          <SplitBar parts={a.devices.map((d) => ({ label: d.device, value: d.views }))} />
        </Panel>
        <Panel title="Platform">
          <BarList
            rows={a.top_os.map((o) => ({
              label: o.os,
              value: o.views,
              sub: o.users ? `${num(o.users)} people` : undefined,
            }))}
            empty="No data yet."
          />
        </Panel>
        <Panel title="Browser">
          <BarList
            rows={a.top_browsers.map((b) => ({
              label: b.browser,
              value: b.views,
              sub: b.users ? `${num(b.users)} people` : undefined,
            }))}
            empty="No data yet."
          />
        </Panel>
        <Panel title="Links out to other sites">
          <BarList
            rows={ev.outbound.map((o) => ({ label: o.label || "unknown", value: o.count }))}
            empty="Nobody has clicked an external link in this window."
          />
        </Panel>
      </div>

      {/* --------------------------------------------------------- behaviour */}
      <h2 className="mt-14 text-lg font-semibold tracking-[-0.02em]">What people do</h2>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="What visitors did"
          note="How many separate visits got as far as each step. Each line is a subset of the one above it, so the right-hand column is where people stopped."
        >
          <FunnelChart steps={funnelSteps(ev, range)} stale={ev.stale} />
        </Panel>

        <Panel title="Reading depth" note="How far into a page a session got, at best.">
          {ev.engagement.avg_scroll === null ? (
            <Empty>No scroll data in this window.</Empty>
          ) : (
            <dl className="space-y-4">
              {[
                ["Average scroll depth", `${ev.engagement.avg_scroll}%`],
                ["Reached 75%", `${ev.engagement.read_75_share}%`],
                ["Median time on page", duration(ev.engagement.median_seconds)],
                ["Average time on page", duration(ev.engagement.avg_seconds)],
                ["Single-page sessions", bounceRate === null ? "—" : `${bounceRate}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4">
                  <dt className="text-[0.85rem] text-ink-50">{k}</dt>
                  <dd className="text-[1.05rem] font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------------------ tools */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Resume ATS checker"
          note={`${num(ev.tools.ats_runs)} runs by ${num(ev.tools.ats_people)} people · average score ${
            ev.tools.ats_avg_score ?? "—"
          }`}
        >
          <BarList
            rows={ev.tools.ats_bands.map((b) => ({ label: b.band, value: b.count }))}
            empty="Nobody has run the checker in this window."
          />
          {ev.tools.ats_failed_read > 0 && (
            <p className="mt-4 border-t border-ink-08 pt-3 text-[0.78rem] leading-relaxed text-ink-30">
              {num(ev.tools.ats_failed_read)} upload
              {ev.tools.ats_failed_read === 1 ? "" : "s"} could not be read at all — an image
              export or a broken PDF. Worth watching: those people got no result.
            </p>
          )}
        </Panel>

        <Panel
          title="In-hand salary calculator"
          note={`${num(ev.tools.salary_runs)} people ran it · median CTC entered ${rupees(
            ev.tools.salary_median_ctc,
          )}`}
        >
          <BarList
            rows={ev.tools.salary_bands.map((b) => ({ label: b.band, value: b.count }))}
            empty="Nobody has run the calculator in this window."
          />
          <p className="mt-4 border-t border-ink-08 pt-3 text-[0.78rem] leading-relaxed text-ink-30">
            The CTC people type in is the closest thing you have to knowing who your audience
            actually is. Write for the band that shows up here.
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Which CTAs get clicked">
          <BarList
            rows={ev.top_ctas.map((c) => ({
              label: c.label ? `${c.location} — ${c.label}` : c.location,
              value: c.count,
            }))}
            empty="No CTA clicks yet."
          />
        </Panel>
        <Panel title="Every event fired" note="Sanity check: if something here is zero, it is not wired up.">
          <BarList
            rows={ev.by_event.map((e) => ({
              label: e.event,
              value: e.count,
              sub: `${num(e.sessions)} sessions`,
            }))}
            empty="No events recorded yet."
          />
        </Panel>
      </div>
    </>
  );
}
