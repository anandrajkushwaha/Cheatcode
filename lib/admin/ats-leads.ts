import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * People who ran the free ATS checker, one row per person.
 *
 * A row in ats_leads is one check; the same person checking three versions of
 * their resume is three rows. Here they are folded into one, keyed by phone,
 * else email, with the latest name and the number of checks — the list is for
 * calling people, and calling someone three times is worse than not at all.
 */

export type Lead = {
  key: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  lastScore: number | null;
  checks: number;
  firstAt: string;
  lastAt: string;
  source: string | null;
  campaign: string | null;
  signedIn: boolean;
};

type Row = {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  score: number | null;
  user_id: string | null;
  source: string | null;
  campaign: string | null;
  created_at: string;
};

export type LeadsResult =
  | { ok: true; leads: Lead[]; checks: number; truncated: boolean }
  | { ok: false; missing: string };

const LIMIT = 5000;

export async function getAtsLeads(): Promise<LeadsResult> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "107_ats_leads.sql" };

  const { data, error } = await db
    .from("ats_leads")
    .select("name,email,phone,linkedin,score,user_id,source,campaign,created_at")
    .order("created_at", { ascending: false })
    .limit(LIMIT + 1);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return { ok: false, missing: "107_ats_leads.sql" };
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Row[];
  const truncated = rows.length > LIMIT;
  const byKey = new Map<string, Lead>();
  // Newest first, so the first row seen for a person is their latest.
  for (const r of rows.slice(0, LIMIT)) {
    const key = r.phone ?? r.email;
    if (!key) continue;
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, {
        key,
        name: r.name,
        phone: r.phone,
        email: r.email,
        linkedin: r.linkedin,
        lastScore: r.score,
        checks: 1,
        firstAt: r.created_at,
        lastAt: r.created_at,
        source: r.source,
        campaign: r.campaign,
        signedIn: !!r.user_id,
      });
      continue;
    }
    cur.checks += 1;
    cur.firstAt = r.created_at;
    cur.name ??= r.name;
    cur.email ??= r.email;
    cur.phone ??= r.phone;
    cur.linkedin ??= r.linkedin;
    cur.signedIn ||= !!r.user_id;
    // What first brought them is the more useful "came from".
    if (r.source) {
      cur.source = r.source;
      cur.campaign = r.campaign;
    }
  }

  return { ok: true, leads: [...byKey.values()], checks: Math.min(rows.length, LIMIT), truncated };
}
