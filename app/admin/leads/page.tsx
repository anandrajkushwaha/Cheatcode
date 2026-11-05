import { Panel } from "@/components/admin/ui";
import { KpiCard } from "@/components/admin/charts";
import { daily, periodOf, split } from "@/lib/admin/period";
import { DataTable } from "@/components/admin/DataTable";
import { RangePicker } from "@/components/admin/RangePicker";
import { resolveRange } from "@/lib/admin/range";
import { getAtsLeads } from "@/lib/admin/ats-leads";

export const dynamic = "force-dynamic";

/**
 * Leads from the free ATS checker — signed in or not.
 *
 * The checker reads the resume in the browser and posts back only the contact
 * block it found (name, email, phone, LinkedIn) with the score and the visit's
 * source; see app/api/tools/ats-lead. That is what turns a free-check ad into
 * names and numbers here rather than a count in Meta.
 */

function phoneText(e164: string) {
  return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
}

export default async function AdminLeads({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = resolveRange({ ...sp, range: sp.range ?? "all" });
  const result = await getAtsLeads();

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not recording yet — run <code>supabase/schemas/{result.missing}</code>.
      </p>
    );
  }

  const { checks, truncated } = result;
  // Cards and table follow the date switch. The table lists people whose
  // latest check falls in the period; the cards count new leads (first check
  // in the period) against the same length of time before it.
  const period = periodOf(range);
  const last = (l: (typeof result.leads)[number]) => l.lastAt;
  const first = (l: (typeof result.leads)[number]) => l.firstAt;
  const leads = split(result.leads, last, period).now;
  const { now: fresh, before: prevFresh } = split(result.leads, first, period);
  const before = (n: number) => (period.all ? undefined : n);
  const isMeta = (l: (typeof result.leads)[number]) => /facebook|instagram|meta/i.test(l.source ?? "");
  const hasPhone = (l: (typeof result.leads)[number]) => Boolean(l.phone);
  const scored = (list: typeof fresh) => list.filter((l) => typeof l.lastScore === "number");
  const avg = (list: typeof fresh) => {
    const s = scored(list);
    return s.length ? Math.round(s.reduce((a, l) => a + (l.lastScore ?? 0), 0) / s.length) : 0;
  };
  const pctOf = (n: number) => (fresh.length ? `${Math.round((n / fresh.length) * 100)}% of new leads` : undefined);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">ATS leads</h1>
          <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
            Everyone who ran the free resume ATS checker, signed in or not — the
            name, phone and email read from their resume. One row per person,
            newest first.
          </p>
        </div>
        <a
          href="/admin/leads/csv"
          className="rounded-full border border-ink-15 px-4 py-2 text-[0.82rem] transition-colors hover:border-ink-30"
        >
          Download CSV
        </a>
      </div>

      <RangePicker basePath="/admin/leads" range={range} allTime />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label={period.all ? "Leads" : "New leads"}
          dark
          now={fresh.length}
          before={before(prevFresh.length)}
          beforeWord={period.beforeWord}
          series={daily(result.leads, first, period)}
          hint={period.all ? `${checks} checks in all` : undefined}
        />
        <KpiCard
          label="Active in period"
          now={leads.length}
          series={daily(result.leads, last, period)}
          hint="latest check in this period"
        />
        <KpiCard
          label="With phone"
          now={fresh.filter(hasPhone).length}
          before={before(prevFresh.filter(hasPhone).length)}
          beforeWord={period.beforeWord}
          series={daily(fresh.filter(hasPhone), first, period)}
          hint={pctOf(fresh.filter(hasPhone).length)}
        />
        <KpiCard
          label="From Meta ads"
          now={fresh.filter(isMeta).length}
          before={before(prevFresh.filter(isMeta).length)}
          beforeWord={period.beforeWord}
          series={daily(fresh.filter(isMeta), first, period)}
          hint={pctOf(fresh.filter(isMeta).length)}
        />
        <KpiCard
          label="Average score"
          now={avg(fresh)}
          before={before(avg(prevFresh))}
          beforeWord={period.beforeWord}
          series={daily(scored(fresh), first, period)}
          hint={period.all ? "latest score per person" : undefined}
        />
      </div>

      <Panel
        title="People"
        note={truncated ? "Showing people from the latest 5,000 checks." : undefined}
      >
        <DataTable
          name="ats-leads"
          empty="Nobody yet. A row appears when someone finishes a check on a resume with an email or phone number on it."
          initialSort={{ key: "last", dir: "desc" }}
          rows={leads.map((l) => ({
            id: l.key,
            name: l.name,
            account: l.signedIn ? "has account" : null,
            phone: l.phone ? phoneText(l.phone) : null,
            wa: l.phone ? `https://wa.me/${l.phone.slice(1)}` : null,
            email: l.email,
            mail: l.email ? `mailto:${l.email}` : null,
            score: l.lastScore,
            checks: l.checks,
            source: l.source,
            campaign: l.campaign,
            last: l.lastAt,
          }))}
          columns={[
            { key: "name", label: "Name", sub: "account", max: "max-w-[14rem]", filter: false },
            { key: "phone", label: "Phone", href: "wa", external: true, filter: false },
            { key: "email", label: "Email", href: "mail", external: true, max: "max-w-[16rem]", filter: false },
            { key: "score", label: "Score", kind: "number" },
            { key: "checks", label: "Checks", kind: "number" },
            { key: "source", label: "Came from", sub: "campaign", max: "max-w-[12rem]" },
            { key: "last", label: "Last check", kind: "date" },
          ]}
        />
      </Panel>
    </div>
  );
}
