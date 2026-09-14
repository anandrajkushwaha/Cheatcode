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
};

export type People = {
  rows: PersonRow[];
  total: number;
  last7: number;
  paid: number;
  /** True when the list was cut short by `limit`. */
  truncated: boolean;
};

export async function getPeople(limit = 500): Promise<Result<People>> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "20_app_accounts.sql" };

  const profiles = await db
    .from("profiles")
    .select("id,full_name,email,phone,plan,plan_status,created_at")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

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
        };
      }),
      total: people.length,
      last7: people.filter((p) => p.created_at >= week).length,
      paid: people.filter((p) => (p.plan ?? "free") !== "free").length,
      truncated,
    },
  };
}
