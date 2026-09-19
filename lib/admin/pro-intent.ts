import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Who reached for the paid plan, and how often.
 *
 * Two sources, and the difference between them is the whole point of this
 * screen:
 *
 *   `pro_intent` is named. One row per signed-in person per visit to the
 *   upgrade screen, with the surface that sent them. It starts the day the
 *   table is created.
 *
 *   `page_views` and `page_events` are anonymous, and were always going to
 *   be. They carry a random visitor id and no user id, which is exactly what
 *   lets the privacy policy promise what it promises. They can say how many
 *   times the upgrade screen was reached before any of this existed. They
 *   cannot say by whom, and no amount of querying will change that.
 *
 * Both are shown. Pretending the historical number is attributable, or
 * leaving it out because it is not, would each be a different way of making
 * the screen less true.
 */

export type Missing = { ok: false; missing: string };

function absent(message: string | undefined, file: string): Missing | null {
  if (!message) return null;
  return /does not exist|schema cache|relation .* does not exist/i.test(message)
    ? { ok: false as const, missing: file }
    : null;
}

export type IntentPerson = {
  userId: string;
  email: string | null;
  name: string | null;
  plan: string;
  clicks: number;
  firstAt: string;
  lastAt: string;
  sources: string[];
};

export type ProIntent = {
  /** Named, from the day the table existed. */
  clicks: number;
  people: number;
  clicks7: number;
  people7: number;
  since: string | null;
  rows: IntentPerson[];
  /** Anonymous, from before — and after; these keep counting either way. */
  historical: { views: number | null; linkClicks: number | null };
};

/** Enough to roll up in memory without a second round trip. */
const MAX_ROWS = 5000;

type Row = {
  user_id: string;
  email: string | null;
  source: string;
  created_at: string;
};

export async function getProIntent(): Promise<
  { ok: true; data: ProIntent } | Missing
> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "20_app_accounts.sql" };

  const { data, error } = await db
    .from("pro_intent")
    .select("user_id, email, source, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  const missing = absent(error?.message, "71_pro_intent.sql");
  if (missing) return missing;
  if (error) return { ok: false, missing: "71_pro_intent.sql" };

  const rows = (data ?? []) as Row[];

  // ------------------------------------------------------------- roll up
  const week = Date.now() - 7 * 86_400_000;
  const byUser = new Map<string, IntentPerson>();

  for (const r of rows) {
    const existing = byUser.get(r.user_id);
    if (existing) {
      existing.clicks += 1;
      // Rows arrive newest first, so the last one seen is the earliest.
      existing.firstAt = r.created_at;
      if (!existing.sources.includes(r.source)) existing.sources.push(r.source);
    } else {
      byUser.set(r.user_id, {
        userId: r.user_id,
        email: r.email,
        name: null,
        plan: "free",
        clicks: 1,
        firstAt: r.created_at,
        lastAt: r.created_at,
        sources: [r.source],
      });
    }
  }

  // ------------------------------------------- names and plans, one query
  const ids = [...byUser.keys()];
  if (ids.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, email, plan")
      .in("id", ids);

    for (const p of profiles ?? []) {
      const person = byUser.get(p.id as string);
      if (!person) continue;
      person.name = (p.full_name as string | null) ?? null;
      person.email = person.email ?? ((p.email as string | null) ?? null);
      person.plan = (p.plan as string | null) ?? "free";
    }
  }

  const people = [...byUser.values()].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );

  const recent = rows.filter((r) => new Date(r.created_at).getTime() >= week);

  return {
    ok: true,
    data: {
      clicks: rows.length,
      people: people.length,
      clicks7: recent.length,
      people7: new Set(recent.map((r) => r.user_id)).size,
      since: rows.length ? rows[rows.length - 1].created_at : null,
      rows: people,
      historical: await historical(),
    },
  };
}

/**
 * The anonymous count, from the analytics tables.
 *
 * A null means the query could not run — the table is missing, or analytics
 * lives in a project this key cannot reach. Null and zero are different
 * answers and the screen says so, because "nobody ever clicked" and "we
 * cannot tell" should never look alike.
 */
async function historical(): Promise<{ views: number | null; linkClicks: number | null }> {
  const db = createAdminClient();
  if (!db) return { views: null, linkClicks: null };

  const [views, clicks] = await Promise.all([
    db
      .from("page_views")
      .select("id", { count: "exact", head: true })
      .eq("path", "/app/upgrade")
      .eq("is_bot", false),
    db
      .from("page_events")
      .select("id", { count: "exact", head: true })
      .eq("label", "/app/upgrade")
      .eq("is_bot", false),
  ]);

  return {
    views: views.error ? null : views.count ?? 0,
    linkClicks: clicks.error ? null : clicks.count ?? 0,
  };
}
