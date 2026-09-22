import { RangePicker } from "@/components/admin/RangePicker";
import { BarList, Empty, FunnelChart, Panel, Stat, TrendChart, num, rupees } from "@/components/admin/ui";
import { resolveRange, rangeWords } from "@/lib/admin/range";
import { getTraffic } from "@/lib/admin/traffic";

export const dynamic = "force-dynamic";

/**
 * The website: how many came, from where, and what they did with the free
 * tools. The Dashboard tab is about the app and what it costs; this one is
 * about the front door.
 */
export default async function AdminTraffic({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const range = resolveRange(await searchParams);
  const result = await getTraffic(range);

  if (!result.ok) {
    const missing = /could not find the function|does not exist|schema cache/i.test(result.error);
    return (
      <div className="rounded-xl border border-ink-15 px-5 py-4 text-[0.85rem] leading-relaxed text-ink-50">
        {missing ? (
          <>
            <p className="font-medium text-ink">One database step is left before this screen works.</p>
            <p className="mt-2">
              The visits are already being recorded; the functions that add them up are not installed.
              In Supabase → SQL Editor, in the project that holds <code>page_views</code>, run these
              files in order:
            </p>
            <ol className="mt-2 list-decimal pl-5">
              <li><code>supabase/schemas/09_owner_exclusion.sql</code></li>
              <li><code>supabase/schemas/10_dashboard.sql</code></li>
              <li><code>supabase/schemas/91_attribution.sql</code></li>
            </ol>
            <p className="mt-2">Then reload this page.</p>
          </>
        ) : (
          <>Traffic can&apos;t be read right now: {result.error}</>
        )}
      </div>
    );
  }
  const t = result.data;
  const bounce = t.sessions ? Math.round((t.bounced / t.sessions) * 100) : 0;
  const toolPages = t.topPages.filter((p) => p.path.startsWith("/tools"));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Traffic</h1>
          <p className="mt-1 text-[0.82rem] text-ink-30">
            {rangeWords(range)} · your own devices and bots are not counted
          </p>
        </div>
        <RangePicker basePath="/admin/traffic" range={range} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Visitors" value={num(t.visitors)} hint="visits (sessions)" now={t.visitors} before={t.prev.visitors} />
        <Stat label="People" value={num(t.users)} hint={`${num(t.newUsers)} new · ${num(t.returningUsers)} returning`} now={t.users} before={t.prev.users} />
        <Stat label="Page views" value={num(t.views)} now={t.views} before={t.prev.views} />
        <Stat label="Left after one page" value={`${bounce}%`} hint={`${num(t.bounced)} of ${num(t.sessions)} visits`} />
      </div>

      <Panel title="Visits over time">
        {t.daily.length ? <TrendChart points={t.daily} /> : <Empty>No visits in this window.</Empty>}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Where people come from"
          note="Per visit, by the source the visit started with — every page of an ad visit counts as the ad, not as 'direct'."
        >
          <BarList
            rows={t.sources.map((s) => ({ label: s.source, value: s.users, sub: `${num(s.views)} views` }))}
            empty="No visits yet."
            unit="people"
          />
        </Panel>

        <Panel
          title="Ad campaigns"
          note="From utm_campaign on the ad's link. Meta ads need the URL parameters set on each ad to appear here."
        >
          {t.campaigns.length ? (
            <BarList
              rows={t.campaigns.map((c) => ({
                label: `${c.campaign}`,
                value: c.visitors,
                sub: `${c.source} · ${num(c.views)} views`,
              }))}
              empty="No campaign traffic yet."
              unit="visits"
            />
          ) : (
            <Empty>
              No tagged ad traffic in this window yet. Ads without utm_campaign still show under
              &ldquo;Where people come from&rdquo; (as google ads, facebook or instagram).
            </Empty>
          )}
        </Panel>
      </div>

      <Panel title="Free tools" note="Runs are completed checks and calculations, not page opens.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="ATS checks run" value={num(t.tools.atsRuns)} hint={`${num(t.tools.atsPeople)} people`} />
          <Stat label="Average ATS score" value={t.tools.atsAvgScore == null ? "—" : String(t.tools.atsAvgScore)} />
          <Stat label="Salary calculations" value={num(t.tools.salaryRuns)} hint={`${num(t.tools.salaryPeople)} people`} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Median CTC entered"
            value={t.tools.salaryMedianCtc == null ? "—" : rupees(t.tools.salaryMedianCtc)}
          />
        </div>
        <div className="mt-6">
          <BarList
            rows={toolPages.map((p) => ({ label: p.path, value: p.users, sub: `${num(p.views)} views` }))}
            empty="No tool pages opened in this window."
            unit="people"
          />
        </div>
      </Panel>

      <Panel title="From visit to sign-up" note="Visits that reached each step in this window.">
        <FunnelChart
          steps={[
            { label: "Visited", value: t.funnel.sessions },
            { label: "Opened a free tool", value: t.funnel.openedTool },
            { label: "Used a free tool", value: t.funnel.usedTool },
            { label: "Saw a sign-up button", value: t.funnel.sawCta },
            { label: "Clicked it", value: t.funnel.clickedCta },
          ]}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Where visits start">
          <BarList rows={t.entryPages.map((p) => ({ label: p.path, value: p.views }))} empty="Nothing yet." unit="visits" />
        </Panel>
        <Panel title="Most viewed pages">
          <BarList
            rows={t.topPages.map((p) => ({ label: p.path, value: p.views, sub: `${num(p.users)} people` }))}
            empty="Nothing yet."
            unit="views"
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Cities">
          <BarList rows={t.cities.map((c) => ({ label: `${c.city}, ${c.country}`, value: c.views }))} empty="Nothing yet." unit="views" />
        </Panel>
        <Panel title="Devices">
          <BarList rows={t.devices.map((d) => ({ label: d.device, value: d.views }))} empty="Nothing yet." unit="views" />
        </Panel>
      </div>
    </div>
  );
}
