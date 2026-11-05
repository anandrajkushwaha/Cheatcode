import { Panel, Stat } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/DataTable";
import { RangePicker } from "@/components/admin/RangePicker";
import { resolveRange } from "@/lib/admin/range";
import { KpiCard } from "@/components/admin/charts";
import { daily, periodOf, split } from "@/lib/admin/period";
import { getProIntent } from "@/lib/admin/pro-intent";

export const dynamic = "force-dynamic";

/**
 * Who reached for the paid plan.
 *
 * The question this answers is the one nothing in the product could answer:
 * with a plan that cannot yet be bought, is anybody trying? A count of people
 * who pressed the button is the closest thing to demand available before
 * payments are connected, and it is worth knowing before building a checkout.
 *
 * The screen deliberately shows two numbers that do not agree, and explains
 * why. The named count starts the day the table was created. The anonymous
 * one comes from analytics that never carried a user id, goes back further,
 * and can never be attributed to a person — because the same design decision
 * that makes those tables safe to keep forever is the one that makes this
 * impossible.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

function when(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : WHEN.format(d);
}

const SOURCE_LABEL: Record<string, string> = {
  header: "Header link",
  home: "Home card",
  "paid-gate": "Locked feature",
  "agent-overlay": "Agent overlay",
  "studio-home": "Studio promo",
  studio: "Studio",
  direct: "Direct",
};

export default async function AdminPro({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange({ ...sp, range: sp.range ?? "all" });
  const result = await getProIntent();

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not recording yet — run <code>supabase/schemas/{result.missing}</code>.
      </p>
    );
  }

  const d = result.data;
  // Cards and table follow the date switch: people whose latest reach for
  // Pro falls in the period, and first-timers against the period before.
  const period = periodOf(range);
  const last = (p: (typeof d.rows)[number]) => p.lastAt;
  const first = (p: (typeof d.rows)[number]) => p.firstAt;
  const { now: rows, before: prevRows } = split(d.rows, last, period);
  const { now: fresh, before: prevFresh } = split(d.rows, first, period);
  const before = (n: number) => (period.all ? undefined : n);
  const isPro = (p: (typeof d.rows)[number]) => p.plan === "pro";
  const repeat = (p: (typeof d.rows)[number]) => p.clicks > 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Pro interest</h1>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Every time a signed-in person reaches the upgrade screen. Repeat
          visits inside thirty minutes count once, so this is people reaching
          for the plan rather than page refreshes.
        </p>
        <div className="mt-4">
          <RangePicker basePath="/admin/pro" range={range} allTime />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Reached for Pro"
          dark
          now={rows.length}
          before={before(prevRows.length)}
          beforeWord={period.beforeWord}
          series={daily(d.rows, last, period)}
          hint={period.all ? `${d.clicks} visits to the upgrade screen` : undefined}
        />
        <KpiCard
          label="First time"
          now={fresh.length}
          before={before(prevFresh.length)}
          beforeWord={period.beforeWord}
          series={daily(d.rows, first, period)}
          hint={period.all ? "people, ever" : undefined}
        />
        <KpiCard
          label="Came back more than once"
          now={rows.filter(repeat).length}
          before={before(prevRows.filter(repeat).length)}
          beforeWord={period.beforeWord}
          series={daily(rows.filter(repeat), last, period)}
          hint={rows.length ? `${Math.round((rows.filter(repeat).length / rows.length) * 100)}% of them` : undefined}
        />
        <KpiCard
          label="Now on Pro"
          now={rows.filter(isPro).length}
          before={before(prevRows.filter(isPro).length)}
          beforeWord={period.beforeWord}
          series={daily(rows.filter(isPro), last, period)}
          hint={rows.length ? `${Math.round((rows.filter(isPro).length / rows.length) * 100)}% of them` : undefined}
        />
      </div>

      <Panel title="Before this was recorded">
        <p className="max-w-[70ch] text-[0.83rem] leading-relaxed text-ink-50">
          Analytics has always counted the upgrade screen, but those rows carry
          a random visitor id and no account — which is what lets the privacy
          policy say we do not tie browsing to a person. So these are real
          counts and they go back further, but nobody can be named from them.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Stat
            label="Upgrade screen views"
            value={d.historical.views ?? "—"}
            hint={d.historical.views === null ? "analytics not reachable" : "all time, bots excluded"}
          />
          <Stat
            label="Link clicks to it"
            value={d.historical.linkClicks ?? "—"}
            hint={
              d.historical.linkClicks === null
                ? "analytics not reachable"
                : "all time, bots excluded"
            }
          />
        </div>
      </Panel>

      <Panel
        title="People"
        note={d.since ? `Recording since ${when(d.since)}.` : undefined}
      >
        <DataTable
          name="pro-interest"
          empty="Nobody has reached the upgrade screen since recording started."
          initialSort={{ key: "last", dir: "desc" }}
          rows={rows.map((p) => ({
            id: p.userId,
            person: p.name ?? "No name",
            email: p.email ?? "no email on file",
            href: `/admin/users/${p.userId}`,
            plan: p.plan,
            clicks: p.clicks,
            from: p.sources.map((x) => SOURCE_LABEL[x] ?? x).join(", "),
            first: p.firstAt,
            last: p.lastAt,
          }))}
          columns={[
            { key: "person", label: "Person", sub: "email", href: "href", max: "max-w-[16rem]", filter: false },
            { key: "plan", label: "Plan", kind: "badge", tones: { pro: "green", free: "grey" } },
            { key: "clicks", label: "Times", kind: "number" },
            { key: "from", label: "From", max: "max-w-[14rem]" },
            { key: "first", label: "First", kind: "date" },
            { key: "last", label: "Last", kind: "date" },
          ]}
        />
      </Panel>
    </div>
  );
}
