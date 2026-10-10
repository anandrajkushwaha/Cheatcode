import { Panel, Stat, Empty } from "@/components/admin/ui";
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

function phoneText(e164: string) {
  return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
}

export default async function AdminLeads() {
  const result = await getAtsLeads();

  if (!result.ok) {
    return (
      <p className="rounded-xl border border-ink-15 px-4 py-3 text-[0.82rem] text-ink-50">
        Not recording yet — run <code>supabase/schemas/{result.missing}</code>.
      </p>
    );
  }

  const { leads, checks, truncated } = result;
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
        {leads.length === 0 ? (
          <Empty>
            Nobody yet. A row appears when someone finishes a check on a resume
            with an email or phone number on it.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[0.85rem]">
              <thead>
                <tr className="border-b border-ink-08 text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Phone</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Score</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Checks</th>
                  <th className="py-2 pr-4 font-medium">Came from</th>
                  <th className="py-2 font-medium">Last check</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {leads.map((l) => (
                  <tr key={l.key} className="border-t border-ink-08 align-top">
                    <td className="max-w-[14rem] py-2.5 pr-4">
                      <span className="block truncate">{l.name ?? "—"}</span>
                      {l.signedIn && <span className="text-[0.72rem] text-ink-30">has account</span>}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4">
                      {l.phone ? (
                        <a href={`https://wa.me/${l.phone.slice(1)}`} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                          {phoneText(l.phone)}
                        </a>
                      ) : (
                        <span className="text-ink-30">—</span>
                      )}
                    </td>
                    <td className="max-w-[16rem] py-2.5 pr-4 text-ink-50">
                      {l.email ? (
                        <a href={`mailto:${l.email}`} className="block truncate underline-offset-4 hover:underline">
                          {l.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pr-4">{l.lastScore ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-ink-50">{l.checks}</td>
                    <td className="max-w-[12rem] py-2.5 pr-4 text-ink-50">
                      <span className="block truncate" title={l.campaign ?? undefined}>
                        {l.source ?? "—"}
                        {l.campaign ? ` · ${l.campaign}` : ""}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-ink-50">{when(l.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
