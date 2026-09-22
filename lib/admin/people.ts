import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * The list of people who have signed in.
 *
 * Deliberately thin. There is already a usage-centric people table on the
 * dashboard — cost per person, sessions, tokens — and it answers "who is
 * expensive". This answers the much plainer question that had no screen at
 * all: *who has an account.*
 *
 * ------------------------------------------------------------- where names live
 *
 * `auth.users` is not in the exposed schema, so none of it is readable from
 * PostgREST at any privilege. Everything here comes from `profiles`, which is
 * written on first sign-in — so a row existing *is* the record that somebody
 * signed in, and `created_at` is when they first did.
 *
 * The consequence worth knowing: this cannot show a last-seen time, because
 * nothing writes one. A "last active" column filled from `updated_at` would
 * look like activity and actually mean "last time any field changed", which is
 * usually never. An absent column is better than a column that lies, so the
 * screen shows what somebody has done instead — résumés, downloads — which is
 * both true and more useful than a timestamp.
 */

export type Missing = { ok: false; missing: string };
type Result<T> = { ok: true; data: T } | Missing;

function absent(message: string | undefined, file: string): Missing | null {
  if (!message) return null;
  return /does not exist|schema cache|relation .* does not exist/i.test(message)
    ? { ok: false as const, missing: file }
    : null;
}

export type PersonRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string;
  planStatus: string;
  joinedAt: string;
  /** How they are identified, when there is no name. */
  handle: string;
  drafts: number;
  downloads: number;
  /** What first brought them here — "meta ads", "google", "direct"… Null if unknown. */
  source: string | null;
  campaign: string | null;
};

export type People = {
  rows: PersonRow[];
  total: number;
  last7: number;
  paid: number;
  /** Sign-ins that had no profile row until this page repaired them. */
  repaired: number;
  /** True when the list was cut short by `limit`. */
  truncated: boolean;
};

export async function getPeople(limit = 500): Promise<Result<People>> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "20_app_accounts.sql" };

  /*
   * Every sign-in first, from Supabase Auth itself.
   *
   * This page used to read `profiles` alone, which is filled by a database
   * trigger on sign-up. Any account whose trigger did not run — created
   * before it existed, or while it was broken — had signed in and simply did
   * not appear here. So the auth user list is read too (the admin API, not
   * PostgREST, can see it), and anybody missing a profile row gets one now.
   */
  let repaired = 0;
  try {
    const authUsers: { id: string; email?: string | null; phone?: string | null; created_at: string; user_metadata?: Record<string, unknown> }[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users?.length) break;
      authUsers.push(...(data.users as typeof authUsers));
      if (data.users.length < 1000) break;
    }
    if (authUsers.length) {
      const { data: have } = await db.from("profiles").select("id").in("id", authUsers.map((u) => u.id));
      const known = new Set(((have ?? []) as { id: string }[]).map((r) => r.id));
      const missing = authUsers.filter((u) => !known.has(u.id));
      if (missing.length) {
        const { error } = await db.from("profiles").upsert(
          missing.map((u) => ({
            id: u.id,
            email: u.email ?? null,
            phone: u.phone || null,
            full_name:
              (u.user_metadata?.full_name as string | undefined) ??
              (u.user_metadata?.name as string | undefined) ??
              null,
            avatar_url: (u.user_metadata?.avatar_url as string | undefined) ?? null,
            created_at: u.created_at,
          })),
          { onConflict: "id", ignoreDuplicates: true },
        );
        if (!error) repaired = missing.length;
        else console.error("[people] profile repair failed", error.message);
      }
    }
  } catch (e) {
    console.error("[people] auth list failed", e);
  }

  const base = "id,full_name,email,phone,plan,plan_status,created_at";
  let profiles = await db
    .from("profiles")
    .select(`${base},signup_source,signup_campaign`)
    .order("created_at", { ascending: false })
    .limit(limit + 1);
  // Before 91_attribution.sql there are no signup columns; list without them.
  if (profiles.error && /signup_/.test(profiles.error.message)) {
    profiles = (await db
      .from("profiles")
      .select(base)
      .order("created_at", { ascending: false })
      .limit(limit + 1)) as typeof profiles;
  }

  const gone = absent(profiles.error?.message, "20_app_accounts.sql");
  if (gone) return gone;

  const all = (profiles.data ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    plan: string | null;
    plan_status: string | null;
    created_at: string;
    signup_source?: string | null;
    signup_campaign?: string | null;
  }[];

  const truncated = all.length > limit;
  const people = truncated ? all.slice(0, limit) : all;

  // One read for everybody's résumé activity, joined in memory. `resume_drafts`
  // is small next to a users table and this avoids a query per row.
  const drafts = await db.from("resume_drafts").select("user_id,download_count");
  const counts = new Map<string, { drafts: number; downloads: number }>();
  for (const d of (drafts.data ?? []) as { user_id: string; download_count: number | null }[]) {
    const cur = counts.get(d.user_id) ?? { drafts: 0, downloads: 0 };
    cur.drafts += 1;
    cur.downloads += Number(d.download_count ?? 0);
    counts.set(d.user_id, cur);
  }

  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();

  return {
    ok: true,
    data: {
      rows: people.map((p) => {
        const c = counts.get(p.id) ?? { drafts: 0, downloads: 0 };
        return {
          id: p.id,
          name: p.full_name,
          email: p.email,
          phone: p.phone,
          plan: p.plan ?? "free",
          planStatus: p.plan_status ?? "inactive",
          joinedAt: p.created_at,
          handle: p.email || p.phone || p.id.slice(0, 8),
          drafts: c.drafts,
          downloads: c.downloads,
          source: p.signup_source ?? null,
          campaign: p.signup_campaign ?? null,
        };
      }),
      total: people.length,
      last7: people.filter((p) => p.created_at >= week).length,
      paid: people.filter((p) => (p.plan ?? "free") !== "free").length,
      repaired,
      truncated,
    },
  };
}
