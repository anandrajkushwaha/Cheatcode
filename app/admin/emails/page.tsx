import { Panel, Stat, Empty } from "@/components/admin/ui";
import { getSegments } from "@/lib/email/segments";
import { getEmailCampaigns } from "@/lib/admin/email-campaigns";

export const dynamic = "force-dynamic";

/**
 * Emails you send yourself, from Gmail. Two things here: who to send to
 * (segments from the same matcher as the jobs page), and what each campaign
 * did — opens and clicks from the tracked HTML, then visits, ATS checks and
 * the match popup for the people it brought in.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default async function AdminEmails() {
  const [seg, camp] = await Promise.all([getSegments(), getEmailCampaigns()]);
  const people = seg.ok ? seg.people : [];
  const list = (s: string) => people.filter((p) => p.segment === s);
  const matched = list("matches").sort((a, b) => (b.best ?? 0) - (a.best ?? 0));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Emails</h1>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Emails you send from Gmail with the tracked HTML. Each campaign is counted by its name in the links (for example{" "}
          <code>resume_match_nov26</code>): opens, clicks, then what those visitors did on the site.
        </p>
      </div>

      <Panel title="Campaigns" note="Opens are approximate (Gmail and Apple load images on their own). Clicks and everything after are exact.">
        {!camp.ok ? (
          <p className="text-[0.84rem] text-ink-50">{camp.error}</p>
        ) : camp.rows.length === 0 ? (
          <Empty>No opens or clicks yet. They appear here as soon as someone opens a tracked email.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-[0.84rem] tabular-nums">
              <thead>
                <tr className="text-[0.68rem] uppercase tracking-[0.12em] text-ink-30">
                  <th className="pb-2 font-medium">Campaign</th>
                  <th className="pb-2 font-medium">First seen</th>
                  <th className="pb-2 text-right font-medium">Opens</th>
                  <th className="pb-2 text-right font-medium">Clicks</th>
                  <th className="pb-2 text-right font-medium">Visitors</th>
                  <th className="pb-2 text-right font-medium">ATS checks</th>
                  <th className="pb-2 text-right font-medium">Saw popup</th>
                  <th className="pb-2 text-right font-medium">Tapped ₹49 / ₹99</th>
                </tr>
              </thead>
              <tbody>
                {camp.rows.map((r) => (
                  <tr key={r.campaign} className="border-t border-ink-08">
                    <td className="py-2 pr-3 font-medium">{r.campaign}</td>
                    <td className="py-2 pr-3 text-ink-50">{r.firstAt ? WHEN.format(new Date(r.firstAt)) : "—"}</td>
                    <td className="py-2 text-right">{r.opens}</td>
                    <td className="py-2 text-right">{r.clicks}</td>
                    <td className="py-2 text-right">{r.visitors}</td>
                    <td className="py-2 text-right">
                      {r.atsChecks} <span className="text-[0.72rem] text-ink-30">{pct(r.atsChecks, r.visitors)}</span>
                    </td>
                    <td className="py-2 text-right">{r.sawPopup}</td>
                    <td className="py-2 text-right">{r.tappedUnlock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {seg.ok && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Resume with matches" value={matched.length} hint="send the match email to these" />
            <Stat label="Resume, no match yet" value={list("resume_no_match").length} />
            <Stat label="No resume" value={list("no_resume").length} />
            <Stat label="Not emailable" value={seg.skipped} hint="phone sign-ups, you" />
          </div>
          <Panel title="Resume with matches" note="Their saved resume genuinely fits open jobs today — the people the 'your resume matches a job' email is true for.">
            {matched.length === 0 ? (
              <Empty>Nobody right now.</Empty>
            ) : (
              <table className="w-full text-left text-[0.84rem] tabular-nums">
                <thead>
                  <tr className="text-[0.68rem] uppercase tracking-[0.12em] text-ink-30">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 text-right font-medium">Matching jobs</th>
                    <th className="pb-2 text-right font-medium">Best</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.map((p) => (
                    <tr key={p.userId} className="border-t border-ink-08">
                      <td className="py-2 pr-3">{p.name ?? "—"}</td>
                      <td className="py-2 pr-3">{p.email}</td>
                      <td className="py-2 text-right">{p.matches}</td>
                      <td className="py-2 text-right">{p.best}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
