import { BarList, Panel, num } from "@/components/admin/ui";
import { KpiCard } from "@/components/admin/charts";
import { daily, periodOf, split } from "@/lib/admin/period";
import { DataTable } from "@/components/admin/DataTable";
import { RangePicker } from "@/components/admin/RangePicker";
import { resolveRange } from "@/lib/admin/range";
import { getPeople } from "@/lib/admin/people";

export const dynamic = "force-dynamic";

/**
 * Everybody who has signed in. Basic on purpose.
 *
 * The dashboard already has a people table and it is about money — cost,
 * tokens, sessions. This is the plain register that was missing: a row per
 * account, newest first, so "how many people do we have and who are they" is
 * one click rather than a query.
 *
 * A row in `profiles` is created on first sign-in, so the list *is* the
 * sign-in list and `created_at` is the moment it happened. There is no
 * last-seen column here because nothing in the product writes one — see the
 * note in lib/admin/people.ts. Résumés built and downloads taken stand in for
 * it, and they have the advantage of being true.
 */

export default async function AdminPeople({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange({ ...sp, range: sp.range ?? "all" });
  const people = await getPeople(1000);

  if (!people.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Accounts cannot be read yet — run <code>supabase/schemas/{people.missing}</code>.
      </p>
    );
  }

  const { total, truncated, repaired } = people.data;
  // Everything on the page follows the date switch: the period's accounts
  // (by when they joined) against the same length of time before it.
  const period = periodOf(range);
  const joined = (p: { joinedAt: string }) => p.joinedAt;
  const { now: rows, before: prevRows } = split(people.data.rows, joined, period);
  const count = (list: typeof rows, test: (p: (typeof rows)[number]) => boolean) => list.filter(test).length;
  const madeResume = (p: (typeof rows)[number]) => p.drafts > 0;
  const downloaded = (p: (typeof rows)[number]) => p.downloads > 0;
  const onPaid = (p: (typeof rows)[number]) => p.plan !== "free";
  const before = (n: number) => (period.all ? undefined : n);
  // Accounts at the end of the period, against the start of it.
  // From the true total, minus those who joined later (they are among the
  // newest rows, which are the ones loaded), so a long history still counts.
  const joinedFrom = (t: number) => people.data.rows.filter((p) => new Date(p.joinedAt).getTime() >= t).length;
  const totalAtEnd = period.all ? total : total - joinedFrom(period.hi);
  const totalAtStart = period.all ? 0 : total - joinedFrom(period.lo);
  const pctOf = (n: number) => (rows.length ? `${Math.round((n / rows.length) * 100)}% of new accounts` : undefined);

  // Where accounts came from, over everybody listed.
  const bySource = new Map<string, number>();
  for (const r of rows) {
    const k = r.source ?? "not recorded";
    bySource.set(k, (bySource.get(k) ?? 0) + 1);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <header className="mb-8">
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">People</h1>
        <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-50">
          Everybody with an account, newest first. A row appears the first time
          somebody signs in.
        </p>
        <div className="mt-4">
          <RangePicker basePath="/admin/users" range={range} allTime />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label={period.all ? "Accounts" : "New accounts"}
          dark
          now={rows.length}
          before={before(prevRows.length)}
          beforeWord={period.beforeWord}
          series={daily(people.data.rows, joined, period)}
          hint={period.all ? "everyone who has signed in" : undefined}
        />
        <KpiCard
          label="Total accounts"
          now={totalAtEnd}
          before={before(totalAtStart)}
          beforeWord="at the start"
          series={daily(people.data.rows, joined, period).reduce<number[]>((acc, v, i) => [...acc, (acc[i - 1] ?? totalAtStart) + v], [])}
          hint={period.all ? "all time" : `+${totalAtEnd - totalAtStart} in this period`}
        />
        <KpiCard
          label="Made a résumé"
          now={count(rows, madeResume)}
          before={before(count(prevRows, madeResume))}
          beforeWord={period.beforeWord}
          series={daily(rows.filter(madeResume), joined, period)}
          hint={pctOf(count(rows, madeResume))}
        />
        <KpiCard
          label="Downloaded a résumé"
          now={count(rows, downloaded)}
          before={before(count(prevRows, downloaded))}
          beforeWord={period.beforeWord}
          series={daily(rows.filter(downloaded), joined, period)}
          hint={pctOf(count(rows, downloaded))}
        />
        <KpiCard
          label="On a paid plan"
          now={count(rows, onPaid)}
          before={before(count(prevRows, onPaid))}
          beforeWord={period.beforeWord}
          series={daily(rows.filter(onPaid), joined, period)}
          hint={pctOf(count(rows, onPaid))}
        />
      </div>

      {repaired > 0 && (
        <p className="mt-4 rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
          {repaired} {repaired === 1 ? "person had" : "people had"} signed in without an account row
          and were missing from this list. They have been added.
        </p>
      )}

      {sources.length > 0 && (
        <Panel
          title="Where accounts came from"
          note="Recorded from the first visit, when somebody first opens the app after signing in. “not recorded” is everyone from before this was switched on."
          className="mt-4"
        >
          <BarList rows={sources.map(([label, value]) => ({ label, value }))} empty="No accounts in this period." unit="accounts" />
        </Panel>
      )}

      <div className="mt-4 rounded-[1.25rem] bg-paper p-6">
        <DataTable
          name="people"
          empty="Nobody has signed in yet."
          initialSort={{ key: "joined", dir: "desc" }}
          rows={rows.map((p) => ({
            id: p.id,
            person: p.name ?? p.handle,
            href: `/admin/users/${p.id}`,
            contact: p.email ?? p.phone ?? null,
            city: p.city,
            joined: p.joinedAt,
            source: p.source,
            campaign: p.campaign,
            drafts: p.drafts,
            downloads: p.downloads,
            plan: p.plan === "free" ? "free" : `${p.plan} · ${p.planStatus}`,
          }))}
          columns={[
            { key: "person", label: "Person", href: "href", max: "max-w-[16rem]", filter: false },
            { key: "contact", label: "Contact", sub: "city", max: "max-w-[15rem]", filter: false },
            { key: "joined", label: "Joined", kind: "date" },
            { key: "source", label: "Came from", sub: "campaign", max: "max-w-[12rem]" },
            { key: "drafts", label: "Résumés", kind: "number" },
            { key: "downloads", label: "Downloads", kind: "number" },
            { key: "plan", label: "Plan", kind: "badge", tones: { free: "grey" } },
          ]}
        />
        {truncated && (
          <p className="mt-4 text-[0.78rem] text-ink-30">
            Showing the most recent {num(people.data.rows.length)}. There are more.
          </p>
        )}
      </div>
    </>
  );
}
