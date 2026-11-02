import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * Emails sent by hand, one row per campaign, followed down the funnel:
 * opens (pixel, approximate) and clicks (the tracked button) from
 * email_campaign_events; then what the visitors who arrived with that
 * utm_campaign did — visits, ATS checks, the match popup and its ₹49 / ₹99
 * buttons — from the tables the site already writes.
 */

export type CampaignRow = {
  campaign: string;
  opens: number;
  clicks: number;
  visitors: number;
  atsChecks: number;
  sawPopup: number;
  tappedUnlock: number;
  firstAt: string | null;
};

export async function getEmailCampaigns(): Promise<{ ok: true; rows: CampaignRow[] } | { ok: false; error: string }> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, error: "Supabase isn't configured." };
  const { data, error } = await db.from("email_campaign_events").select("campaign,kind,created_at").limit(50000);
  if (error) return { ok: false, error: error.message.includes("email_campaign_events") ? "Run supabase/schemas/118_email_campaign_events.sql" : error.message };

  const byCampaign = new Map<string, { opens: number; clicks: number; firstAt: string }>();
  for (const e of (data ?? []) as { campaign: string; kind: string; created_at: string }[]) {
    const c = byCampaign.get(e.campaign) ?? { opens: 0, clicks: 0, firstAt: e.created_at };
    if (e.kind === "open") c.opens += 1;
    else c.clicks += 1;
    if (e.created_at < c.firstAt) c.firstAt = e.created_at;
    byCampaign.set(e.campaign, c);
  }

  const rows: CampaignRow[] = [];
  for (const [campaign, c] of byCampaign) {
    const [views, leads] = await Promise.all([
      db.from("page_views").select("visitor_id").eq("campaign", campaign).eq("is_bot", false).limit(20000),
      db.from("ats_leads").select("id", { count: "exact", head: true }).eq("campaign", campaign),
    ]);
    const visitors = [...new Set(((views.data ?? []) as { visitor_id: string | null }[]).map((v) => v.visitor_id).filter(Boolean) as string[])];
    let sawPopup = 0;
    let tappedUnlock = 0;
    if (visitors.length) {
      const { data: pop } = await db.from("match_popup_events").select("visitor,event").in("visitor", visitors).limit(20000);
      const ev = (pop ?? []) as { visitor: string; event: string }[];
      sawPopup = new Set(ev.filter((e) => e.event === "shown").map((e) => e.visitor)).size;
      tappedUnlock = new Set(ev.filter((e) => e.event === "unlock_click" || e.event === "pass_click").map((e) => e.visitor)).size;
    }
    rows.push({ campaign, opens: c.opens, clicks: c.clicks, visitors: visitors.length, atsChecks: leads.count ?? 0, sawPopup, tappedUnlock, firstAt: c.firstAt });
  }
  rows.sort((a, b) => (b.firstAt ?? "").localeCompare(a.firstAt ?? ""));
  return { ok: true, rows };
}
