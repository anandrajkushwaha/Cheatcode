import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { QueueStatus } from "@/types/db";

export type AdminStats = {
  configured: boolean;
  posts: number;
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
    configured: false, posts: 0, postsLast7: 0, queuePending: 0, queueDone: 0,
    queueFailed: 0, waitlist: 0, avgWords: 0, avgQuality: 0, byCategory: [],
  };
  if (!db) return empty;

  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [posts, recent, cats, waitlist, queue] = await Promise.all([
    db.from("posts").select("id,word_count,quality_score,category_id"),
    db.from("posts").select("id", { count: "exact", head: true }).gte("published_at", weekAgo),
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
