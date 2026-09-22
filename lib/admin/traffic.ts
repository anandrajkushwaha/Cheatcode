import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Range } from "@/lib/admin/range";

/**
 * Website traffic for the admin: who came, from where, and what they did with
 * the free tools. Reads the rollups our own tracker already feeds
 * (analytics_summary and events_summary in 10_dashboard.sql) — the numbers
 * were being collected all along; the screen for them had been taken away.
 *
 * Our own browsers, bots and excluded devices are already out of these.
 */

type Row<T extends string> = Record<T, string | number>;

export type Traffic = {
  views: number;
  visitors: number;
  users: number;
  newUsers: number;
  returningUsers: number;
  prev: { views: number; visitors: number; users: number };
  bounced: number;
  sessions: number;
  daily: { day: string; views: number; visitors: number; users: number }[];
  sources: { source: string; views: number; users: number }[];
  entryPages: { path: string; views: number }[];
  topPages: { path: string; views: number; users: number }[];
  devices: { device: string; views: number }[];
  cities: { city: string; country: string; views: number }[];
  tools: {
    atsRuns: number;
    atsPeople: number;
    atsAvgScore: number | null;
    salaryRuns: number;
    salaryPeople: number;
    salaryMedianCtc: number | null;
  };
  funnel: {
    sessions: number;
    openedTool: number;
    usedTool: number;
    sawCta: number;
    clickedCta: number;
  };
  campaigns: { source: string; campaign: string; visitors: number; views: number }[];
};

const n = (v: unknown) => Number(v ?? 0) || 0;

export async function getTraffic(range: Range): Promise<{ ok: true; data: Traffic } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Supabase isn't configured." };

  const args = { p_days: range.days, p_from: range.from ?? null, p_to: range.to ?? null };
  const since = range.from ?? new Date(Date.now() - range.days * 86_400_000).toISOString();

  const [a, e, c] = await Promise.all([
    db.rpc("analytics_summary", args),
    db.rpc("events_summary", args),
    db
      .from("page_views")
      .select("source,campaign,session_id")
      .eq("is_bot", false)
      .not("campaign", "is", null)
      .gte("created_at", since)
      .limit(20000),
  ]);

  if (a.error) return { ok: false, error: a.error.message };
  const s = (a.data ?? {}) as Record<string, unknown>;
  const ev = (e.data ?? {}) as Record<string, unknown>;
  const tools = (ev.tools ?? {}) as Record<string, unknown>;
  const f = (ev.funnel ?? {}) as Record<string, unknown>;

  // Campaigns: visitors and views per source + utm_campaign. The column
  // arrives with 91_attribution.sql; before that this is simply empty.
  const camp = new Map<string, { source: string; campaign: string; sessions: Set<string>; views: number }>();
  if (!c.error) {
    for (const r of (c.data ?? []) as { source: string | null; campaign: string | null; session_id: string | null }[]) {
      const key = `${r.source}|${r.campaign}`;
      const cur = camp.get(key) ?? {
        source: r.source ?? "unknown",
        campaign: r.campaign ?? "",
        sessions: new Set<string>(),
        views: 0,
      };
      cur.views += 1;
      if (r.session_id) cur.sessions.add(r.session_id);
      camp.set(key, cur);
    }
  }

  const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);

  return {
    ok: true,
    data: {
      views: n(s.views),
      visitors: n(s.visitors),
      users: n(s.unique_users),
      newUsers: n(s.new_users),
      returningUsers: n(s.returning_users),
      prev: { views: n(s.prev_views), visitors: n(s.prev_visitors), users: n(s.prev_users) },
      bounced: n(s.sessions_bounced),
      sessions: n(s.sessions_total),
      daily: list<Row<"day" | "views" | "visitors" | "users">>(s.daily).map((d) => ({
        day: String(d.day),
        views: n(d.views),
        visitors: n(d.visitors),
        users: n(d.users),
      })),
      sources: list<Row<"source" | "views" | "users">>(s.top_sources).map((r) => ({
        source: String(r.source),
        views: n(r.views),
        users: n(r.users),
      })),
      entryPages: list<Row<"path" | "views">>(s.entry_pages).map((r) => ({ path: String(r.path), views: n(r.views) })),
      topPages: list<Row<"path" | "views" | "users">>(s.top_pages).map((r) => ({
        path: String(r.path),
        views: n(r.views),
        users: n(r.users),
      })),
      devices: list<Row<"device" | "views">>(s.devices).map((r) => ({ device: String(r.device), views: n(r.views) })),
      cities: list<Row<"city" | "country" | "views">>(s.top_cities).map((r) => ({
        city: String(r.city),
        country: String(r.country),
        views: n(r.views),
      })),
      tools: {
        atsRuns: n(tools.ats_runs),
        atsPeople: n(tools.ats_people),
        atsAvgScore: tools.ats_avg_score == null ? null : n(tools.ats_avg_score),
        salaryRuns: n(tools.salary_runs),
        salaryPeople: n(tools.salary_people),
        salaryMedianCtc: tools.salary_median_ctc == null ? null : n(tools.salary_median_ctc),
      },
      funnel: {
        sessions: n(f.sessions),
        openedTool: n(f.opened_tool),
        usedTool: n(f.used_tool),
        sawCta: n(f.saw_cta),
        clickedCta: n(f.clicked_cta),
      },
      campaigns: [...camp.values()]
        .map((v) => ({ source: v.source, campaign: v.campaign, visitors: v.sessions.size, views: v.views }))
        .sort((x, y) => y.visitors - x.visitors)
        .slice(0, 20),
    },
  };
}
