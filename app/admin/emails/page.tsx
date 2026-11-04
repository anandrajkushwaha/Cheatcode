import { Panel, Empty } from "@/components/admin/ui";
import { DataTable } from "@/components/admin/DataTable";
import { getEmailCampaigns } from "@/lib/admin/email-campaigns";

export const dynamic = "force-dynamic";

/**
 * Emails you send yourself, from Gmail: what each campaign did — opens and
 * clicks from the tracked HTML, then visits, ATS checks and the match popup
 * for the people it brought in.
 */


export default async function AdminEmails() {
  const camp = await getEmailCampaigns();

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
          <DataTable
            name="email-campaigns"
            initialSort={{ key: "first", dir: "desc" }}
            rows={camp.rows.map((r) => ({
              id: r.campaign,
              campaign: r.campaign,
              first: r.firstAt,
              opens: r.opens,
              clicks: r.clicks,
              visitors: r.visitors,
              ats: r.atsChecks,
              atsPct: r.visitors ? `${Math.round((r.atsChecks / r.visitors) * 100)}% of visitors` : null,
              popup: r.sawPopup,
              tapped: r.tappedUnlock,
            }))}
            columns={[
              { key: "campaign", label: "Campaign" },
              { key: "first", label: "First seen", kind: "date" },
              { key: "opens", label: "Opens", kind: "number" },
              { key: "clicks", label: "Clicks", kind: "number" },
              { key: "visitors", label: "Visitors", kind: "number" },
              { key: "ats", label: "ATS checks", kind: "number", sub: "atsPct" },
              { key: "popup", label: "Saw popup", kind: "number" },
              { key: "tapped", label: "Tapped ₹49 / ₹99", kind: "number" },
            ]}
          />
        )}
      </Panel>
    </div>
  );
}
