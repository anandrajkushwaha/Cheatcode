import { Panel, Empty, BarList } from "@/components/admin/ui";
import { PeopleCards } from "@/components/admin/PeopleCards";
import { KpiCard } from "@/components/admin/charts";
import { RangePicker } from "@/components/admin/RangePicker";
import { getUserAnalytics, summarise } from "@/lib/admin/user-analytics";
import { resolveRange } from "@/lib/admin/range";
import { daily, periodOf, split } from "@/lib/admin/period";

export const dynamic = "force-dynamic";

/**
 * Who is using this.
 *
 * People counts accounts and where they came from. This reads what they
 * typed: the name, city, phone and job title go into a résumé long before
 * anybody edits a profile, so the résumé is the source and the profile is
 * the fallback.
 *
 * Every figure here is something a person entered or something the ATS check
 * already computed. The one derived number is the age, and it is labelled an
 * estimate everywhere it appears — there is no date of birth in this product,
 * so it is a graduation year plus twenty-two and nothing more.
 */
export default async function AdminUserAnalytics({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange({ ...sp, range: sp.range ?? "7d" });
  const data = await getUserAnalytics();

  if ("missing" in data) {
    return (
      <div className="space-y-6">
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.02em]">User analytics</h1>
        <Panel title="Cannot read">
          <Empty>The accounts database is not reachable.</Empty>
        </Panel>
      </div>
    );
  }

  // Everything follows the date switch: the people who joined in the period
  // (all of them for "All time"), against the same length of time before it.
  const period = periodOf(range);
  const joined = (p: (typeof data.people)[number]) => p.joined;
  const { now: people, before: prev } = split(data.people, joined, period);
  const { stages, domains, cities, commonGaps, withResume, sampleOnly, fromDesign } = summarise(people);
  const p0 = summarise(prev);
  const before = (n: number) => (period.all ? undefined : n);
  const of = (n: number) => (people.length ? `${Math.round((n / people.length) * 100)}% of them` : undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.02em]">User analytics</h1>
        <p className="mt-1 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Who signed up, read from their résumé (profile where it is empty). Age is an estimate from the graduation year.
        </p>
        <div className="mt-4">
          <RangePicker basePath="/admin/user-analytics" range={range} allTime />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={period.all ? "People" : "Joined"}
          dark
          now={people.length}
          before={before(prev.length)}
          beforeWord={period.beforeWord}
          series={daily(data.people, joined, period)}
          hint={period.all ? "everyone with an account" : undefined}
        />
        <KpiCard
          label="Told us who they are"
          now={withResume}
          before={before(p0.withResume)}
          beforeWord={period.beforeWord}
          series={daily(people.filter((x) => x.source === "resume"), joined, period)}
          hint={of(withResume)}
        />
        <KpiCard
          label="Recovered from the canvas"
          now={fromDesign}
          before={before(p0.fromDesign)}
          beforeWord={period.beforeWord}
          series={daily(people.filter((x) => x.source === "design"), joined, period)}
          hint={of(fromDesign)}
        />
        <KpiCard
          label="Still on the sample"
          now={sampleOnly}
          before={before(p0.sampleOnly)}
          beforeWord={period.beforeWord}
          series={daily(people.filter((x) => x.source === "sample"), joined, period)}
          hint={of(sampleOnly)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Career stage" note="From years of experience, or no work history at all.">
          <BarList
            rows={stages.map((s) => ({ label: s.label, value: s.count }))}
            empty="Nobody has said yet."
          />
        </Panel>

        <Panel title="Field" note="Their own job title, sorted by keyword. No AI, no guessing.">
          <BarList
            rows={domains.map((d) => ({ label: d.label, value: d.count }))}
            empty="No job titles yet."
          />
        </Panel>

        <Panel title="Cities" note="As written on the résumé.">
          <BarList
            rows={cities.map((c) => ({ label: c.label, value: c.count }))}
            empty="No cities yet."
          />
        </Panel>

        <Panel
          title="What their résumés are missing"
          note="The checks the ATS scan failed or warned on, across everybody."
        >
          <BarList
            rows={commonGaps.map((g) => ({ label: g.label, value: g.count }))}
            empty="Nothing scored yet."
          />
        </Panel>
      </div>

      <Panel title="Everybody" note="Search, filter or sort. Open a card's gaps to see what their résumé is missing.">
        {people.length === 0 ? (
          <Empty>Nobody joined in this period.</Empty>
        ) : (
          <PeopleCards people={people} />
        )}
      </Panel>
    </div>
  );
}
