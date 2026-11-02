import { Panel, Stat, Empty } from "@/components/admin/ui";
import { EmailActions } from "@/components/admin/EmailActions";
import { getSegments } from "@/lib/email/segments";
import { CAMPAIGN, renderAtsUpload } from "@/lib/email/ats-upload";
import { emailConfigured } from "@/lib/email/send";
import { getCampaignReport } from "@/lib/admin/emails";

export const dynamic = "force-dynamic";

/**
 * Emails to signed-up people. One campaign for now: people whose saved
 * resume matches no open job get "upload your resume and see the jobs it
 * matches", which opens the free ATS checker — and its match popup.
 * Segments come from the same matcher as the jobs page (lib/email/segments).
 */

const WHEN = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default async function AdminEmails() {
  const [seg, report] = await Promise.all([getSegments(), getCampaignReport(CAMPAIGN)]);
  if (!seg.ok) return <p className="text-[0.85rem] text-ink-50">Couldn&apos;t build segments: {seg.error}</p>;

  const count = (s: string) => seg.people.filter((p) => p.segment === s).length;
  const rows = report.ok ? report.rows : [];
  const sentTo = new Set(rows.map((r) => r.email));
  const eligible = seg.people.filter((p) => p.segment === "resume_no_match" && !sentTo.has(p.email)).length;
  const sent = rows.filter((r) => r.status === "sent");
  const preview = renderAtsUpload({ firstName: "Priya", openJobs: seg.openJobs, teasers: seg.teasers, token: "preview0000000000" });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em]">Emails</h1>
        <p className="mt-2 max-w-[70ch] text-[0.85rem] leading-relaxed text-ink-50">
          Campaign <code>{CAMPAIGN}</code>: people whose saved resume matches no open job yet. The email sends them to the free ATS
          checker; after their upload, genuine matches open the ₹49 / ₹99 popup. Each person gets it once; unsubscribes are never
          emailed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Resume, no match" value={count("resume_no_match")} hint="this campaign" />
        <Stat label="Resume with matches" value={count("matches")} />
        <Stat label="No resume" value={count("no_resume")} />
        <Stat label="Not emailable" value={seg.skipped} hint="phone sign-ups, you, unsubscribed" />
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Stat label="Sent" value={sent.length} />
        <Stat label="Opened" value={sent.filter((r) => r.opened).length} hint={`${pct(sent.filter((r) => r.opened).length, sent.length)} · approximate`} />
        <Stat label="Clicked" value={sent.filter((r) => r.clicked).length} hint={pct(sent.filter((r) => r.clicked).length, sent.length)} />
        <Stat label="Checked resume" value={sent.filter((r) => r.checkedResume).length} hint={pct(sent.filter((r) => r.checkedResume).length, sent.length)} />
        <Stat label="Paid" value={`₹${sent.reduce((n, r) => n + r.paidRupees, 0)}`} hint={`${sent.filter((r) => r.paidRupees > 0).length} people`} />
      </div>

      <Panel title="Send" note={`Subject: “${preview.subject.replace("Priya", "<first name>")}”`}>
        <EmailActions eligible={eligible} configured={emailConfigured()} />
      </Panel>

      <Panel title="Preview" note="Exactly what a recipient sees (name and links are per person).">
        <iframe title="Email preview" srcDoc={preview.html} className="h-[820px] w-full rounded-xl border border-ink-08 bg-white" />
      </Panel>

      <Panel title="Recipients" note={report.ok ? `${rows.length} sent so far` : report.error}>
        {rows.length === 0 ? (
          <Empty>Nobody emailed yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-[0.84rem]">
              <thead>
                <tr className="text-[0.68rem] uppercase tracking-[0.12em] text-ink-30">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Sent</th>
                  <th className="pb-2 font-medium">Opened</th>
                  <th className="pb-2 font-medium">Clicked</th>
                  <th className="pb-2 font-medium">Checked resume</th>
                  <th className="pb-2 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email} className="border-t border-ink-08">
                    <td className="py-2 pr-3">
                      {r.email}
                      {r.unsubscribed && <span className="ml-2 text-[0.72rem] text-ink-30">unsubscribed</span>}
                    </td>
                    <td className="py-2 pr-3 text-ink-50">
                      {r.status === "sent" && r.sentAt ? WHEN.format(new Date(r.sentAt)) : <span title={r.error ?? ""}>{r.status}</span>}
                    </td>
                    <td className="py-2 pr-3">{r.opened ? "✓" : "—"}</td>
                    <td className="py-2 pr-3">{r.clicked ? `✓ ${r.clicks > 1 ? `×${r.clicks}` : ""}` : "—"}</td>
                    <td className="py-2 pr-3">{r.checkedResume ? `✓ ${r.atsScore ?? ""}` : "—"}</td>
                    <td className="py-2">{r.paidRupees ? `₹${r.paidRupees}` : "—"}</td>
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
