import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminStats = {
  configured: boolean;
  posts: number;
  postsLive: number;
  postsScheduled: number;
  postsLast7: number;
  postsPrev7: number;
  waitlist: number;
  waitlistLast7: number;
  avgWords: number;
  avgQuality: number;
  byCategory: { name: string; slug: string; count: number }[];
};

export async function getAdminStats(): Promise<AdminStats> {
  const db = createAdminClient();
  const empty: AdminStats = {
    configured: false, posts: 0, postsLive: 0, postsScheduled: 0, postsLast7: 0,
    postsPrev7: 0, waitlist: 0, waitlistLast7: 0, avgWords: 0, avgQuality: 0, byCategory: [],
  };
  if (!db) return empty;

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const twoWeeksAgo = new Date(Date.now() - 14 * 864e5).toISOString();
  const nowIso = new Date().toISOString();

  const [posts, recent, prior, cats, waitlist, waitlistRecent] = await Promise.all([
    db.from("posts").select("id,word_count,quality_score,category_id,published_at"),
    db.from("posts").select("id", { count: "exact", head: true })
      .gte("published_at", weekAgo).lte("published_at", nowIso),
    db.from("posts").select("id", { count: "exact", head: true })
      .gte("published_at", twoWeeksAgo).lt("published_at", weekAgo),
    db.from("categories").select("id,slug,name").order("sort_order"),
    db.from("waitlist").select("id", { count: "exact", head: true }),
    db.from("waitlist").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);

  const rows = posts.data ?? [];

  const catById = Object.fromEntries((cats.data ?? []).map((c) => [c.id, c]));
  const tally: Record<string, number> = {};
  for (const r of rows) {
    const c = catById[(r as { category_id: string }).category_id];
    if (c) tally[c.slug] = (tally[c.slug] ?? 0) + 1;
  }

  return {
    configured: true,
    posts: rows.length,
    postsLive: rows.filter((r) => (r as { published_at: string }).published_at <= nowIso).length,
    postsScheduled: rows.filter((r) => (r as { published_at: string }).published_at > nowIso).length,
    postsLast7: recent.count ?? 0,
    postsPrev7: prior.count ?? 0,
    waitlist: waitlist.count ?? 0,
    waitlistLast7: waitlistRecent.count ?? 0,
    avgWords: rows.length ? Math.round(rows.reduce((a, r) => a + (r.word_count ?? 0), 0) / rows.length) : 0,
    avgQuality: rows.length ? Math.round(rows.reduce((a, r) => a + (r.quality_score ?? 0), 0) / rows.length) : 0,
    byCategory: (cats.data ?? []).map((c) => ({ name: c.name, slug: c.slug, count: tally[c.slug] ?? 0 })),
  };
}

export async function getAdminPosts(limit = 100) {
  const db = createAdminClient();
  if (!db) return [];
  const { data } = await db
    .from("posts")
    .select("id,slug,title,post_type,status,published_at,word_count,quality_score,category:categories(name)")
    .order("published_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getWaitlist(limit = 200) {
  const db = createAdminClient();
  if (!db) return [];
  const { data } = await db
    .from("waitlist")
    .select("id,email,source,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ---------------------------------------------------------------- analytics

export type Analytics = {
  configured: boolean;
  days: number;
  views: number;
  prev_views: number;
  visitors: number;
  prev_visitors: number;
  unique_users: number;
  prev_users: number;
  views_today: number;
  visitors_today: number;
  users_today: number;
  views_all_time: number;
  users_all_time: number;
  new_users: number;
  returning_users: number;
  sessions_total: number;
  sessions_bounced: number;
  views_per_session: number | null;
  excluded_devices: number;
  bots_blocked: number;
  daily: { day: string; views: number; visitors: number; users: number }[];
  entry_pages: { path: string; views: number }[];
  top_pages: { path: string; views: number; users: number }[];
  top_sources: { source: string; views: number; users: number }[];
  top_countries: { country: string; views: number }[];
  top_cities: { city: string; country: string; views: number }[];
  devices: { device: string; views: number }[];
  top_os: { os: string; views: number; users: number }[];
  top_browsers: { browser: string; views: number; users: number }[];
};

const EMPTY_ANALYTICS: Analytics = {
  configured: false, days: 7, views: 0, prev_views: 0, visitors: 0, prev_visitors: 0,
  unique_users: 0, prev_users: 0, views_today: 0, visitors_today: 0, users_today: 0,
  views_all_time: 0, users_all_time: 0, new_users: 0, returning_users: 0,
  sessions_total: 0, sessions_bounced: 0, views_per_session: null,
  excluded_devices: 0, bots_blocked: 0, daily: [], entry_pages: [], top_pages: [],
  top_sources: [], top_countries: [], top_cities: [], devices: [],
  top_os: [], top_browsers: [],
};

export async function getAnalytics(days = 7): Promise<Analytics & { error?: string }> {
  const db = createAdminClient();
  if (!db) return EMPTY_ANALYTICS;

  const { data, error } = await db.rpc("analytics_summary", { p_days: days });
  if (error) {
    // Most likely cause: 05_analytics.sql hasn't been run yet.
    return { ...EMPTY_ANALYTICS, days, error: error.message };
  }
  return { ...EMPTY_ANALYTICS, ...(data as object), configured: true, days };
}

// ---------------------------------------------------------------- schedule

export async function getScheduledPosts(limit = 200) {
  const db = createAdminClient();
  if (!db) return [];
  const { data } = await db
    .from("posts")
    .select("id,slug,title,post_type,published_at,word_count,quality_score,category:categories(name)")
    .gt("published_at", new Date().toISOString())
    .order("published_at", { ascending: true })
    .limit(limit);
  return data ?? [];
}

export async function getRecentlyPublished(limit = 10) {
  const db = createAdminClient();
  if (!db) return [];
  const { data } = await db
    .from("posts")
    .select("id,slug,title,published_at")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ---------------------------------------------------------------- events

export type Funnel = {
  sessions: number;
  read_article: number;
  read_deeply: number;
  opened_tool: number;
  used_tool: number;
  saw_cta: number;
  clicked_cta: number;
  joined: number;
};

export type EventsSummary = {
  days: number;
  total: number;
  bots_blocked: number;
  by_event: { event: string; count: number; sessions: number }[];
  top_ctas: { location: string; label: string; count: number; sessions: number }[];
  outbound: { label: string; count: number }[];
  engagement: {
    avg_scroll: number | null;
    read_75_share: number;
    avg_seconds: number | null;
    median_seconds: number | null;
  };
  tools: {
    ats_runs: number;
    ats_people: number;
    ats_avg_score: number | null;
    ats_failed_read: number;
    ats_bands: { band: string; count: number }[];
    salary_runs: number;
    salary_people: number;
    salary_median_ctc: number | null;
    salary_bands: { band: string; count: number }[];
  };
  funnel: Funnel;
  prev_funnel: { used_tool: number; joined: number };
  error?: string;
};

const EMPTY_EVENTS: EventsSummary = {
  days: 7, total: 0, bots_blocked: 0, by_event: [], top_ctas: [], outbound: [],
  engagement: { avg_scroll: null, read_75_share: 0, avg_seconds: null, median_seconds: null },
  tools: {
    ats_runs: 0, ats_people: 0, ats_avg_score: null, ats_failed_read: 0, ats_bands: [],
    salary_runs: 0, salary_people: 0, salary_median_ctc: null, salary_bands: [],
  },
  funnel: {
    sessions: 0, read_article: 0, read_deeply: 0, opened_tool: 0,
    used_tool: 0, saw_cta: 0, clicked_cta: 0, joined: 0,
  },
  prev_funnel: { used_tool: 0, joined: 0 },
};

export async function getEvents(days = 7): Promise<EventsSummary> {
  const db = createAdminClient();
  if (!db) return EMPTY_EVENTS;
  const { data, error } = await db.rpc("events_summary", { p_days: days });
  if (error) return { ...EMPTY_EVENTS, days, error: error.message };
  return { ...EMPTY_EVENTS, ...(data as object), days };
}

// ---------------------------------------------------------------- content

export type ContentRow = {
  path: string;
  kind: "article" | "tool" | "listing" | "page";
  views: number;
  readers: number;
  sessions: number;
  entries: number;
  avg_scroll: number;
  finished_share: number;
  avg_seconds: number;
  cta_clicks: number;
  google_views: number;
};

export type ContentPerformance = {
  days: number;
  rows: ContentRow[];
  totals: { pages: number; articles: number; views: number };
  error?: string;
};

const EMPTY_CONTENT: ContentPerformance = {
  days: 30, rows: [], totals: { pages: 0, articles: 0, views: 0 },
};

export async function getContentPerformance(days = 30, limit = 100): Promise<ContentPerformance> {
  const db = createAdminClient();
  if (!db) return EMPTY_CONTENT;
  const { data, error } = await db.rpc("content_performance", { p_days: days, p_limit: limit });
  if (error) return { ...EMPTY_CONTENT, days, error: error.message };
  return { ...EMPTY_CONTENT, ...(data as object), days };
}

/** Titles for the article paths a performance row names, so the table reads. */
export async function getPostTitles(paths: string[]): Promise<Record<string, string>> {
  const db = createAdminClient();
  const slugs = paths
    .filter((p) => p.startsWith("/blog/") && !p.startsWith("/blog/category/") && !p.startsWith("/blog/page/"))
    .map((p) => p.replace("/blog/", "").replace(/\/$/, ""));
  if (!db || slugs.length === 0) return {};
  const { data } = await db.from("posts").select("slug,title").in("slug", slugs);
  return Object.fromEntries((data ?? []).map((p) => [`/blog/${p.slug}`, p.title as string]));
}
