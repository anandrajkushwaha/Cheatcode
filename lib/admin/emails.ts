import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * The campaign report: every real send, and what each person did after it —
 * opened (pixel, approximate), clicked (exact), checked a resume on the ATS
 * checker, and paid for a job unlock or pass.
 */

export type SendRow = {
  email: string;
  status: string;
  error: string | null;
  sentAt: string | null;
  opened: boolean;
  clicked: boolean;
  clicks: number;
  unsubscribed: boolean;
  checkedResume: boolean;
  atsScore: number | null;
  paidRupees: number;
};

export async function getCampaignReport(campaign: string): Promise<{ ok: true; rows: SendRow[] } | { ok: false; error: string }> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, error: "Supabase isn't configured." };
  const { data, error } = await db
    .from("email_sends")
    .select("email,user_id,status,error,sent_at,opened_at,clicked_at,click_count,unsubscribed_at")
    .eq("campaign", campaign)
    .neq("status", "test")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) return { ok: false, error: error.message.includes("email_sends") ? "Run supabase/schemas/117_email_sends.sql" : error.message };
  const sends = (data ?? []) as {
    email: string; user_id: string | null; status: string; error: string | null; sent_at: string | null;
    opened_at: string | null; clicked_at: string | null; click_count: number; unsubscribed_at: string | null;
  }[];
  const emails = sends.map((s) => s.email);
  const users = sends.map((s) => s.user_id).filter(Boolean) as string[];
  const [leads, paid] = await Promise.all([
    emails.length ? db.from("ats_leads").select("email,score,created_at").in("email", emails) : Promise.resolve({ data: [] }),
    users.length ? db.from("job_unlocks").select("user_id,amount_paise,paid_at").eq("status", "paid").in("user_id", users) : Promise.resolve({ data: [] }),
  ]);

  const rows = sends.map((s) => {
    const after = (iso: string | null) => Boolean(iso && s.sent_at && iso >= s.sent_at);
    const lead = ((leads.data ?? []) as { email: string; score: number | null; created_at: string }[])
      .filter((l) => l.email?.toLowerCase() === s.email && after(l.created_at))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const paise = ((paid.data ?? []) as { user_id: string; amount_paise: number; paid_at: string | null }[])
      .filter((p) => p.user_id === s.user_id && after(p.paid_at))
      .reduce((n, p) => n + p.amount_paise, 0);
    return {
      email: s.email,
      status: s.status,
      error: s.error,
      sentAt: s.sent_at,
      opened: Boolean(s.opened_at),
      clicked: Boolean(s.clicked_at),
      clicks: s.click_count,
      unsubscribed: Boolean(s.unsubscribed_at),
      checkedResume: Boolean(lead),
      atsScore: lead?.score ?? null,
      paidRupees: paise / 100,
    };
  });
  return { ok: true, rows };
}
