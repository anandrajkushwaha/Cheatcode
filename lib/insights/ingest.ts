import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readArticle, readFeed, type FeedItem } from "@/lib/insights/feeds";
import { sameStory, titleKey, writeInsight } from "@/lib/insights/write";

/**
 * One morning's run: read every feed, keep what is new and relevant, write it.
 *
 * Bounded twice. At most WRITE_LIMIT stories reach the model per run, which
 * caps the day's spend whatever the feeds do; and the run stops starting new
 * work once TIME_BUDGET_MS has passed, so it finishes inside the function's
 * 60 seconds instead of being killed half-written.
 */
const WRITE_LIMIT = 24;
const PARALLEL = 6;
const TIME_BUDGET_MS = 48_000;
/** Older than this, a story is not news any more. */
const MAX_AGE_DAYS = 3;

type Source = { id: number; name: string; feed_url: string };

export async function runInsightsIngest(db: SupabaseClient) {
  const started = Date.now();

  const { data: sources, error } = await db
    .from("insight_sources")
    .select("id, name, feed_url")
    .eq("active", true);
  if (error) return { ok: false as const, error: error.message };

  // 1. Every feed at once — they are independent and mostly slow.
  const read = await Promise.all(
    ((sources ?? []) as Source[]).map(async (s) => {
      const r = await readFeed(s.feed_url, s.name);
      await db
        .from("insight_sources")
        .update({
          last_run_at: new Date().toISOString(),
          last_status: r.ok ? "ok" : "error",
          last_count: r.ok ? r.items.length : 0,
          last_error: r.ok ? null : r.error.slice(0, 300),
        })
        .eq("id", s.id);
      return r.ok ? r.items : [];
    }),
  );

  // 2. Fresh, not seen before, not the same story twice.
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const candidates = read
    .flat()
    .filter((i) => !i.publishedAt || new Date(i.publishedAt).getTime() >= cutoff)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  const urls = candidates.map((c) => c.url);
  const { data: known } = urls.length
    ? await db.from("insights").select("source_url").in("source_url", urls.slice(0, 500))
    : { data: [] };
  const seenUrl = new Set((known ?? []).map((k: { source_url: string }) => k.source_url));

  const since = new Date(Date.now() - 4 * 86_400_000).toISOString();
  const { data: recent } = await db
    .from("insights")
    .select("title_key")
    .gte("created_at", since)
    .limit(500);
  const keys: string[] = (recent ?? []).map((r: { title_key: string | null }) => r.title_key ?? "");

  const queue: FeedItem[] = [];
  for (const c of candidates) {
    if (queue.length >= WRITE_LIMIT) break;
    if (seenUrl.has(c.url)) continue;
    const key = titleKey(c.title);
    if (keys.some((k) => sameStory(k, key))) continue;
    keys.push(key);
    seenUrl.add(c.url);
    queue.push(c);
  }

  // 3. Read, judge and write, a few at a time, inside the time budget.
  let written = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < queue.length; i += PARALLEL) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const batch = queue.slice(i, i + PARALLEL);
    const results = await Promise.all(
      batch.map(async (item) => {
        const article = /news\.google\.com/.test(item.url) ? "" : await readArticle(item.url);
        const out = await writeInsight(item, article);
        if (!out) return "skipped" as const;
        const { error: insertError } = await db.from("insights").insert({
          title: out.title,
          summary: out.summary,
          category: out.category,
          relevance: out.relevance,
          source_name: item.sourceName,
          source_url: item.url,
          published_at: item.publishedAt,
          title_key: titleKey(item.title),
        });
        if (insertError) {
          // A unique clash is another run getting there first — not an error.
          if (!/duplicate/i.test(insertError.message)) errors.push(insertError.message);
          return "skipped" as const;
        }
        return "written" as const;
      }),
    );
    written += results.filter((r) => r === "written").length;
    skipped += results.filter((r) => r === "skipped").length;
  }

  return {
    ok: true as const,
    feeds: sources?.length ?? 0,
    candidates: candidates.length,
    queued: queue.length,
    written,
    skipped,
    errors: errors.slice(0, 5),
    ms: Date.now() - started,
  };
}
