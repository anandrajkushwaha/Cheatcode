import Link from "next/link";
import { getAdminStats, getAnalytics, getEvents, getScheduledPosts } from "@/lib/queries/admin";
import { SeedButton } from "@/components/admin/SeedButton";
import { RangePicker } from "@/components/admin/RangePicker";
import { DeviceExclusion } from "@/components/admin/DeviceExclusion";
import { StaleSchemaNotice } from "@/components/admin/StaleSchemaNotice";
import { resolveRange, rangeWords, IST } from "@/lib/admin/range";
import {
  BarList, FunnelChart, Panel, SplitBar, Stat, TrendChart, duration, num,
} from "@/components/admin/ui";

function istShort(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    hour12: true, timeZone: IST,
  }).format(new Date(iso));
}

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const range = resolveRange(await searchParams);

  const [s, traffic, events, scheduled] = await Promise.all([
    getAdminStats(),
    getAnalytics(range.days, range.from, range.to),
    getEvents(range.days, range.from, range.to),
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
  const words = rangeWords(range);
  const mobileShare = (() => {
    const total = traffic.devices.reduce((a, d) => a + d.views, 0);
    const m = traffic.devices.find((d) => d.device === "mobile")?.views ?? 0;
    return total ? `${Math.round((m / total) * 100)}%` : "—";
  })();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Overview</h1>
        <RangePicker basePath="/admin" range={range} />
      </div>

      <StaleSchemaNotice stale={traffic.stale || events.stale} />
      <DeviceExclusion excludedDevices={traffic.excluded_devices} />

      {/* --------------------------------------------------------- headline */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            title={`Traffic · ${words}`}
            action={{ label: "Full traffic report", href: "/admin/analytics" }}
          >
            <TrendChart points={traffic.daily} />
          </Panel>
        </div>
      )}

      {/* ----------------------------------------------------------- funnel */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="From reader to signup"
          note={`Unique sessions reaching each step in ${words}. The right-hand column is where people leave.`}
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

        <Panel title="Your audience" note={`People seen in ${words}.`}>
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
              ["Median time on page", duration(events.engagement.median_seconds)],
              ["Mobile share", mobileShare],
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
          <dl className="space-y-3.5">
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
          <Link
            href="/admin/posts/new"
            className="mt-5 inline-block rounded-full bg-ink px-4 py-2 text-[0.82rem] font-medium text-paper"
          >
            Write a new article
          </Link>
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
