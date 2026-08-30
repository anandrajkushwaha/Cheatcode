import Link from "next/link";
import {
  getAdminStats, getAnalytics, getEvents, getPostTitles, getScheduledPosts,
} from "@/lib/queries/admin";
import { SeedButton } from "@/components/admin/SeedButton";
import {
  BarList, Empty, FunnelChart, Panel, SplitBar, Stat, TrendChart, duration, num,
} from "@/components/admin/ui";

const IST = "Asia/Kolkata";

function istShort(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    hour12: true, timeZone: IST,
  }).format(new Date(iso));
}

export default async function AdminOverview() {
  const [s, traffic, events, scheduled] = await Promise.all([
    getAdminStats(),
    getAnalytics(7),
    getEvents(7),
    getScheduledPosts(1),
  ]);

  if (!s.configured) {
    return (
      <div className="rounded-2xl border border-ink-08 p-8">
        <h1 className="text-xl font-semibold">Supabase isn&apos;t connected</h1>
        <p className="mt-3 max-w-[60ch] text-[0.95rem] leading-relaxed text-ink-50">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>SUPABASE_SECRET_KEY</code> in
          Vercel → Settings → Environment Variables, then redeploy.
        </p>
      </div>
    );
  }

  const tracking = !traffic.error;
  const bounceRate = traffic.sessions_total
    ? Math.round((traffic.sessions_bounced / traffic.sessions_total) * 100)
    : null;

  // A landing page is only useful if you can tell which article it is.
  const titles = await getPostTitles(traffic.entry_pages.map((p) => p.path));
  const label = (path: string) => titles[path] ?? path;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Overview</h1>
        <p className="text-[0.8rem] text-ink-30">Last 7 days, compared with the 7 before it</p>
      </div>

      {/* ---------------------------------------------------------- headline */}
      {/* Four cards, one row, no ragged tail. These are the only four numbers
          worth glancing at daily; everything else lives one click away. */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="People"
          value={tracking ? traffic.unique_users : "—"}
          now={traffic.unique_users}
          before={traffic.prev_users}
          hint={tracking ? undefined : "tracking not set up"}
        />
        <Stat
          label="Page views"
          value={tracking ? traffic.views : "—"}
          now={traffic.views}
          before={traffic.prev_views}
        />
        <Stat
          label="Used a tool"
          value={events.funnel.used_tool}
          now={events.funnel.used_tool}
          before={events.prev_funnel.used_tool}
        />
        <Stat
          label="Joined the waitlist"
          value={s.waitlist}
          hint={`${s.waitlistLast7} in the last 7 days`}
        />
      </div>

      {/* ------------------------------------------------------------ trend */}
      {tracking && (
        <div className="mt-4">
          <Panel
            title="Traffic, last 7 days"
            action={{ label: "Full traffic report", href: "/admin/analytics" }}
          >
            <TrendChart points={traffic.daily} />
          </Panel>
        </div>
      )}

      {/* ---------------------------------------------------------- reading */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Where people land"
          note="The first page of a session — the front doors Google is actually sending people to."
          action={{ label: "By article", href: "/admin/content" }}
        >
          <BarList
            rows={traffic.entry_pages.slice(0, 6).map((p) => ({
              label: label(p.path),
              value: p.views,
              href: p.path,
            }))}
            empty="No sessions recorded yet."
          />
        </Panel>

        <Panel title="Where they came from" action={{ label: "All", href: "/admin/analytics" }}>
          <BarList
            rows={traffic.top_sources.slice(0, 6).map((x) => ({
              label: x.source,
              value: x.views,
              sub: x.users ? `${num(x.users)} people` : undefined,
            }))}
            empty="No traffic recorded yet."
          />
        </Panel>

        <Panel
          title="Do they read it"
          note="Averaged over every page a session opened."
        >
          {events.engagement.avg_scroll === null ? (
            <Empty>No scroll data yet.</Empty>
          ) : (
            <dl className="space-y-4">
              {[
                ["Average scroll depth", `${events.engagement.avg_scroll}%`],
                ["Reached 75% of the page", `${events.engagement.read_75_share}%`],
                ["Median time on page", duration(events.engagement.median_seconds)],
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

      {/* ----------------------------------------------------------- funnel */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="From reader to signup"
          note="Unique sessions reaching each step in the last 7 days."
          action={{ label: "Detail", href: "/admin/analytics" }}
        >
          <FunnelChart
            steps={[
              { label: "Sessions", value: events.funnel.sessions },
              { label: "Opened an article", value: events.funnel.read_article },
              { label: "Read most of it", value: events.funnel.read_deeply, note: "75%+" },
              { label: "Opened a tool", value: events.funnel.opened_tool },
              { label: "Ran the tool", value: events.funnel.used_tool },
              { label: "Saw a CTA", value: events.funnel.saw_cta },
              { label: "Clicked a CTA", value: events.funnel.clicked_cta },
              { label: "Joined the waitlist", value: events.funnel.joined },
            ]}
          />
        </Panel>

        <Panel title="Your audience" note="People seen in the last 7 days.">
          <SplitBar
            parts={[
              { label: "First time here", value: traffic.new_users },
              { label: "Been here before", value: traffic.returning_users },
            ]}
          />
          <dl className="mt-6 space-y-3.5 border-t border-ink-08 pt-5">
            {[
              ["Sessions", num(traffic.visitors)],
              ["Pages per session", traffic.views_per_session?.toFixed(2) ?? "—"],
              ["Today so far", `${num(traffic.users_today)} people · ${num(traffic.views_today)} views`],
              ["Mobile share", (() => {
                const total = traffic.devices.reduce((a, d) => a + d.views, 0);
                const m = traffic.devices.find((d) => d.device === "mobile")?.views ?? 0;
                return total ? `${Math.round((m / total) * 100)}%` : "—";
              })()],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4">
                <dt className="text-[0.85rem] text-ink-50">{k}</dt>
                <dd className="text-[0.95rem] font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      {/* --------------------------------------------------------- library */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="The library" action={{ label: "All articles", href: "/admin/posts" }}>
          <dl className="space-y-4">
            {[
              ["Live", num(s.postsLive)],
              ["Scheduled", num(s.postsScheduled)],
              ["Published this week", num(s.postsLast7)],
              ["The week before", num(s.postsPrev7)],
              ["Average length", `${num(s.avgWords)} words`],
              ["Average quality score", `${s.avgQuality}/100`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4">
                <dt className="text-[0.85rem] text-ink-50">{k}</dt>
                <dd className="text-[0.95rem] font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {scheduled[0] && (
            <p className="mt-5 border-t border-ink-08 pt-4 text-[0.8rem] leading-relaxed text-ink-30">
              Next out:{" "}
              <Link href="/admin/schedule" className="text-ink-50 underline underline-offset-4">
                {scheduled[0].title as string}
              </Link>
              , {istShort(scheduled[0].published_at as string)} IST
            </p>
          )}
        </Panel>

        <Panel className="lg:col-span-2" title="Articles by topic">
          <BarList
            rows={s.byCategory
              .filter((c) => c.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((c) => ({ label: c.name, value: c.count }))}
            empty="No articles yet."
          />
        </Panel>
      </div>

      <div className="mt-8 border-t border-ink-08 pt-8">
        <SeedButton hasPosts={s.posts > 0} />
      </div>
    </>
  );
}
