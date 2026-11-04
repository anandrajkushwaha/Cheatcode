import Link from "next/link";
import { KpiCard, MetricChart } from "@/components/admin/charts";
import type { Activity, Overview } from "@/lib/admin/overview";

/** The Dashboard's body, given the period's numbers (app/admin/page.tsx). */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const DOT: Record<Activity["kind"], string> = {
  signup: "bg-[#3b82f6]",
  payment: "bg-[#22c55e]",
  ats: "bg-[#f59e0b]",
  download: "bg-ink",
};

function Card({
  title,
  href,
  children,
  className = "",
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-[1.25rem] bg-paper p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.95rem] font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="rounded-full px-2.5 py-1 text-[0.74rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            View all →
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Ranked({
  rows,
  money = false,
  empty,
}: {
  rows: { label: string; value: number }[];
  money?: boolean;
  empty: string;
}) {
  if (rows.length === 0)
    return (
      <p className="py-6 text-center text-[0.82rem] text-ink-30">{empty}</p>
    );
  const top = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[0.82rem]">
            <span className="min-w-0 truncate" title={r.label}>
              {r.label}
            </span>
            <span className="shrink-0 tabular-nums text-ink-50">
              {money
                ? `₹${Math.round(r.value).toLocaleString("en-IN")}`
                : r.value.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-04">
            <div
              className="h-full rounded-full bg-[#9be15d]"
              style={{ width: `${(r.value / top) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardView({
  data,
  beforeWord,
}: {
  data: Overview;
  beforeWord?: string;
}) {
  const result = { data };
  return (
    <div className="space-y-4 rounded-[1.75rem] bg-[#f0f0ec] p-3 sm:p-4">
      {/* -------------------------------------------------------- KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="col-span-2 flex lg:col-span-1 [&>*]:flex-1">
          <KpiCard
            beforeWord={beforeWord}
            label="Revenue"
            money
            dark
            {...result.data.kpis.revenue}
          />
        </div>
        <KpiCard
          beforeWord={beforeWord}
          label="Visitors"
          {...result.data.kpis.visitors}
        />
        <KpiCard
          beforeWord={beforeWord}
          label="Sign-ups"
          {...result.data.kpis.signups}
        />
        <KpiCard
          beforeWord={beforeWord}
          label="ATS checks"
          {...result.data.kpis.atsChecks}
        />
        <KpiCard
          beforeWord={beforeWord}
          label="Resume downloads"
          {...result.data.kpis.downloads}
        />
      </div>

      {/* ----------------------------------------- chart + funnel/alerts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="min-w-0 rounded-[1.25rem] bg-paper p-5 lg:col-span-2">
          <MetricChart
            labels={result.data.labels}
            metrics={[
              {
                id: "visitors",
                label: "Visitors",
                series: result.data.kpis.visitors.series,
                total: result.data.kpis.visitors.now,
              },
              {
                id: "signups",
                label: "Sign-ups",
                series: result.data.kpis.signups.series,
              },
              {
                id: "ats",
                label: "ATS checks",
                series: result.data.kpis.atsChecks.series,
              },
              {
                id: "downloads",
                label: "Downloads",
                series: result.data.kpis.downloads.series,
              },
              {
                id: "revenue",
                label: "Revenue",
                series: result.data.kpis.revenue.series,
                money: true,
              },
            ]}
          />
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Funnel" href="/admin/journeys">
            <ol className="space-y-3">
              {result.data.funnel.map((f, i) => {
                const top = result.data.funnel[0].value || 1;
                return (
                  <li key={f.label}>
                    <div className="flex items-baseline justify-between gap-3 text-[0.82rem]">
                      <span>{f.label}</span>
                      <span className="tabular-nums">
                        <span className="font-semibold">
                          {f.value.toLocaleString("en-IN")}
                        </span>
                        {i > 0 ? (
                          <span className="ml-1.5 text-[0.72rem] text-ink-30">
                            {Math.round((f.value / top) * 100)}% of visitors
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-04">
                      <div
                        className={`h-full rounded-full ${i === result.data.funnel.length - 1 ? "bg-[#9be15d]" : "bg-ink"}`}
                        style={{
                          width: `${Math.max(2, (f.value / top) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card title="Needs attention">
            {result.data.alerts.length === 0 ? (
              <p className="text-[0.82rem] text-ink-50">
                ✓ Nothing waiting on you.
              </p>
            ) : (
              <ul className="space-y-2">
                {result.data.alerts.map((a) => (
                  <li key={a.text}>
                    <Link
                      href={a.href}
                      className="flex items-center justify-between gap-3 rounded-xl bg-[#fff4e0] px-3 py-2.5 text-[0.8rem] text-[#7a4b00] transition-colors hover:bg-[#ffe9c2]"
                    >
                      <span>{a.text}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* ------------------------------------------- where / what / money */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Top sources" href="/admin/traffic">
          <Ranked
            rows={result.data.sources}
            empty="No visits in this period."
          />
        </Card>
        <Card title="Top pages" href="/admin/pages">
          <Ranked
            rows={result.data.pages}
            empty="No page views in this period."
          />
        </Card>
        <Card title="Revenue by product" href="/admin/match-popup">
          <Ranked
            rows={result.data.revenueBy}
            money
            empty="No payments in this period yet."
          />
        </Card>
      </div>

      {/* ---------------------------------------------------- activity */}
      <Card title="Latest activity" href="/admin/users">
        {result.data.activity.length === 0 ? (
          <p className="py-6 text-center text-[0.82rem] text-ink-30">
            Nothing in this period yet.
          </p>
        ) : (
          <ul className="divide-y divide-ink-08">
            {result.data.activity.map((a, i) => (
              <li
                key={a.at + i}
                className="flex items-center gap-3 py-2.5 text-[0.84rem]"
              >
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${DOT[a.kind]}`}
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{a.who}</span>{" "}
                  <span className="text-ink-50">{a.what}</span>
                </span>
                <span className="shrink-0 text-[0.74rem] tabular-nums text-ink-30">
                  {WHEN.format(new Date(a.at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
