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
  /**
   * Free-tool runs that ended in nothing usable. Counted separately from
   * `tools` above on purpose: a checker that quietly fails on one phone
   * shows up there only as a number that is lower than it should be, which
   * is invisible. Here the reason the browser gave is the label.
   */
  toolFailures: {
    total: number;
    runs: number;
    reasons: { reason: string; count: number }[];
    fileTypes: { fileType: string; count: number }[];
    devices: { device: string; count: number }[];
    inApp: number;
  };
};

const n = (v: unknown) => Number(v ?? 0) || 0;

export async function getTraffic(range: Range): Promise<{ ok: true; data: Traffic } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Supabase isn't configured." };

  const args = { p_days: range.days, p_from: range.from ?? null, p_to: range.to ?? null };
  const since = range.from ?? new Date(Date.now() - range.days * 86_400_000).toISOString();

  const [a, e, c, tf] = await Promise.all([
    db.rpc("analytics_summary", args),
    db.rpc("events_summary", args),
    db
      .from("page_views")
      .select("source,campaign,session_id")
      .eq("is_bot", false)
      .not("campaign", "is", null)
      .gte("created_at", since)
      .limit(20000),
    // Every tool_compute in the window, successes included — the failure
    // count only means something next to the number of attempts.
    db
      .from("page_events")
      .select("params,device")
      .eq("event", "tool_compute")
      .eq("is_bot", false)
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

  // ---------- free tools that failed ----------
  // The browser's own message is the label. It is truncated to 120 characters
  // at the point it is recorded, and near-identical messages differing only in
  // a file name or a byte offset would otherwise each become their own row, so
  // the varying parts are flattened before counting.
  const fail = {
    total: 0,
    runs: 0,
    reasons: new Map<string, number>(),
    fileTypes: new Map<string, number>(),
    devices: new Map<string, number>(),
    inApp: 0,
  };
  if (!tf.error) {
    for (const r of (tf.data ?? []) as { params: Record<string, unknown> | null; device: string | null }[]) {
      const p = r.params ?? {};
      fail.runs += 1;
      const outcome = typeof p.outcome === "string" ? p.outcome : "";
      if (outcome !== "error" && outcome !== "no-text") continue;

      fail.total += 1;
      const reason =
        outcome === "no-text"
          ? "No readable text in the file (scan or image)"
          : normaliseReason(typeof p.reason === "string" ? p.reason : "Unknown error");
      bump(fail.reasons, reason);
      bump(fail.fileTypes, (typeof p.file_type === "string" && p.file_type) || "unknown");
      bump(fail.devices, r.device || "unknown");
      if (p.in_app === true || p.in_app === "true") fail.inApp += 1;
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
      toolFailures: {
        total: fail.total,
        runs: fail.runs,
        reasons: rank(fail.reasons).map(([reason, count]) => ({ reason, count })),
        fileTypes: rank(fail.fileTypes).map(([fileType, count]) => ({ fileType, count })),
        devices: rank(fail.devices).map(([device, count]) => ({ device, count })),
        inApp: fail.inApp,
      },
    },
  };
}

/* ------------------------------------------------------------------ util */

function bump(m: Map<string, number>, key: string) {
  m.set(key, (m.get(key) ?? 0) + 1);
}

function rank(m: Map<string, number>) {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
}

/**
 * One row per cause, not one row per occurrence.
 *
 * The same failure carries a different file name, byte offset or object id
 * every time, so counting the raw strings gives a list of ones and tells you
 * nothing. These are flattened first, and the few we already know by name are
 * given the sentence that says what to do about them.
 */
function normaliseReason(raw: string): string {
  const r = raw.trim();
  if (!r) return "Unknown error";

  if (/withResolvers|Promise\.try|URL\.parse|AbortSignal\.any|is not a function|undefined is not an object/i.test(r))
    return `Browser too old for the PDF reader — ${r.slice(0, 60)}`;
  if (/password|encrypted/i.test(r)) return "The PDF is password-protected";
  if (/InvalidPDF|not a PDF|Invalid PDF structure|corrupt/i.test(r)) return "The file is not a readable PDF";
  if (/worker/i.test(r)) return "The PDF worker could not start";
  if (/network|fetch|load failed|Failed to fetch/i.test(r)) return "The reader could not be downloaded (network)";
  if (/zip|docx|central directory/i.test(r)) return "The Word file could not be unzipped";
  if (/memory|allocation/i.test(r)) return "The device ran out of memory on that file";

  return r
    .replace(/\b[\w.-]+\.(pdf|docx|doc|txt|odt|rtf)\b/gi, "<file>")
    .replace(/\b\d{3,}\b/g, "<n>")
    .slice(0, 90);
}
