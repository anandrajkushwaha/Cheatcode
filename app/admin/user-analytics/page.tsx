import { Panel, Stat, Empty, BarList, num } from "@/components/admin/ui";
import { PeopleCards } from "@/components/admin/PeopleCards";
import { getUserAnalytics } from "@/lib/admin/user-analytics";

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
export default async function AdminUserAnalytics() {
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

  const { people, stages, domains, cities, commonGaps, withResume } = data;
  const withPhone = people.filter((p) => p.phone).length;
  const withCity = people.filter((p) => p.city).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.02em]">User analytics</h1>
        <p className="mt-1 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Read from what people actually typed — their résumé first, their profile only where
          the résumé is empty. A field nobody filled shows a dash rather than a guess. Age is
          the exception and is always marked an estimate: it is worked out from the graduation
          year, because nothing here asks for a date of birth.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="People" value={num(people.length)} />
        <Stat
          label="Told us who they are"
          value={num(withResume)}
          hint={people.length ? `${Math.round((withResume / people.length) * 100)}% have a résumé with details` : undefined}
        />
        <Stat label="Gave a phone number" value={num(withPhone)} />
        <Stat label="Gave a city" value={num(withCity)} />
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

      <Panel title="Everybody" note="Search by name, email, phone, city or role. Open a card to see that person's gaps.">
        {people.length === 0 ? (
          <Empty>No accounts yet.</Empty>
        ) : (
          <PeopleCards people={people} />
        )}
      </Panel>
    </div>
  );
}
