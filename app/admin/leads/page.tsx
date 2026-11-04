import { Panel, Stat } from "@/components/admin/ui";
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
  // People whose latest check falls in the period (everyone for "All time").
  const lo = range.id === "all" ? 0 : range.from ? new Date(range.from).getTime() : Date.now() - range.days * 86_400_000;
  const hi = range.to ? new Date(range.to).getTime() : Infinity;
  const leads = result.leads.filter((l) => {
    const t = new Date(l.lastAt).getTime();
    return t >= lo && t < hi;
  });
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const last7 = leads.filter((l) => l.firstAt >= week).length;
  const fromMeta = leads.filter((l) => /facebook|instagram|meta/i.test(l.source ?? "")).length;
  const withPhone = leads.filter((l) => l.phone).length;

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

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="People" value={leads.length} hint={`${checks} checks in all`} />
        <Stat label="New, 7d" value={last7} hint="first check this week" />
        <Stat label="With phone" value={withPhone} hint="Indian mobile found" />
        <Stat label="From Meta" value={fromMeta} hint="Instagram / Facebook" />
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
