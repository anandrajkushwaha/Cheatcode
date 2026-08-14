import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { QueueStatus } from "@/types/db";

export type AdminStats = {
  configured: boolean;
  posts: number;
  postsLive: number;
  postsScheduled: number;
  postsLast7: number;
  queuePending: number;
  queueDone: number;
  queueFailed: number;
  waitlist: number;
  avgWords: number;
  avgQuality: number;
  byCategory: { name: string; slug: string; count: number }[];
};

export async function getAdminStats(): Promise<AdminStats> {
  const db = createAdminClient();
  const empty: AdminStats = {
    configured: false, posts: 0, postsLive: 0, postsScheduled: 0, postsLast7: 0, queuePending: 0, queueDone: 0,
    queueFailed: 0, waitlist: 0, avgWords: 0, avgQuality: 0, byCategory: [],
  };
  if (!db) return empty;

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const nowIso = new Date().toISOString();

  const [posts, recent, cats, waitlist, queue] = await Promise.all([
    db.from("posts").select("id,word_count,quality_score,category_id,published_at"),
    db.from("posts").select("id", { count: "exact", head: true })
      .gte("published_at", weekAgo).lte("published_at", nowIso),
    db.from("categories").select("id,slug,name").order("sort_order"),
    db.from("waitlist").select("id", { count: "exact", head: true }),
    db.from("keyword_queue").select("status"),
  ]);

  const rows = posts.data ?? [];
  const qrows = (queue.data ?? []) as { status: QueueStatus }[];
  const countBy = (s: QueueStatus) => qrows.filter((r) => r.status === s).length;

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
    queuePending: countBy("pending"),
    queueDone: countBy("done"),
    queueFailed: countBy("failed") + countBy("claimed"),
    waitlist: waitlist.count ?? 0,
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

export async function getAdminQueue(status: string | null, limit = 200) {
  const db = createAdminClient();
  if (!db) return [];
  let q = db
    .from("keyword_queue")
    .select("id,focus_keyword,category_slug,post_type,slot,priority,status,attempts,last_error,est_volume_in")
    .order("status")
    .order("priority")
    .limit(limit);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return data ?? [];
}

export async function getPublishLog(limit = 50) {
  const db = createAdminClient();
  if (!db) return [];
  const { data } = await db
    .from("publish_log")
    .select("*")
    .order("created_at", { ascending: false })
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
  visitors: number;
  views_today: number;
  visitors_today: number;
  views_all_time: number;
  daily: { day: string; views: number; visitors: number }[];
  top_pages: { path: string; views: number }[];
  top_sources: { source: string; views: number }[];
  top_countries: { country: string; views: number }[];
  top_cities: { city: string; country: string; views: number }[];
  devices: { device: string; views: number }[];
};

const EMPTY_ANALYTICS: Analytics = {
  configured: false, days: 7, views: 0, visitors: 0, views_today: 0,
  visitors_today: 0, views_all_time: 0, daily: [], top_pages: [],
  top_sources: [], top_countries: [], top_cities: [], devices: [],
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

export type EventsSummary = {
  days: number;
  total: number;
  bots_blocked: number;
  by_event: { event: string; count: number; sessions: number }[];
  top_ctas: { location: string; label: string; count: number }[];
  outbound: { label: string; count: number }[];
  funnel: Record<string, number>;
  error?: string;
};

const EMPTY_EVENTS: EventsSummary = {
  days: 7, total: 0, bots_blocked: 0, by_event: [], top_ctas: [],
  outbound: [], funnel: {},
};

export async function getEvents(days = 7): Promise<EventsSummary> {
  const db = createAdminClient();
  if (!db) return EMPTY_EVENTS;
  const { data, error } = await db.rpc("events_summary", { p_days: days });
  if (error) return { ...EMPTY_EVENTS, days, error: error.message };
  return { ...EMPTY_EVENTS, ...(data as object), days };
}
