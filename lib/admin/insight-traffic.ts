import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * How each insight actually did.
 *
 * An insight is read inside the app's reader, which never navigates to
 * /insights/<id>, so for a long time nothing at all was recorded against one
 * and every card read zero. The reader now fires a read event against that
 * public path, and the share dialog files its shares there too, so all three
 * ways an insight is met — read in the app, opened on the web as a shared
 * link, and passed on — land on the same key and can be added up here.
 *
 * No date range: an insight is news. It gets its readers in the two days
 * after it goes up and then stops, so a lifetime total is the honest number
 * and a 7-day window would show almost everything as zero.
 */

export type InsightStat = {
  /** Read in the app's Insights tab. */
  reads: number;
  /** Opened at /insights/<id> — somebody followed a shared link. */
  webViews: number;
  people: number;
  shares: number;
};

export type InsightTraffic = {
  by: Record<string, InsightStat>;
  totals: InsightStat;
  /** False when the analytics tables could not be read at all. */
  ok: boolean;
};

const EMPTY: InsightStat = { reads: 0, webViews: 0, people: 0, shares: 0 };

export async function getInsightTraffic(): Promise<InsightTraffic> {
  const db = createAdminClient();
  if (!db) return { by: {}, totals: { ...EMPTY }, ok: false };

  const [e, v] = await Promise.all([
    db
      .from("page_events")
      .select("event,label,visitor_id,location")
      .eq("is_bot", false)
      .in("event", ["article_view", "content_share"])
      .like("label", "/insights/%")
      .limit(50_000),
    db
      .from("page_views")
      .select("path,visitor_id")
      .eq("is_bot", false)
      .like("path", "/insights/%")
      .limit(50_000),
  ]);

  if (e.error && v.error) return { by: {}, totals: { ...EMPTY }, ok: false };

  const acc = new Map<string, { reads: number; webViews: number; shares: number; people: Set<string> }>();
  const at = (id: string) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { reads: 0, webViews: 0, shares: 0, people: new Set() }));
    return a;
  };

  for (const r of (e.data ?? []) as {
    event: string;
    label: string | null;
    visitor_id: string | null;
    location: string | null;
  }[]) {
    const id = idOf(r.label);
    if (!id) continue;
    const a = at(id);
    if (r.event === "content_share") a.shares += 1;
    // Only the in-app reader. A read counted from anywhere else would be the
    // same visit as the page view below, counted twice.
    else if (r.location === "app-reader") a.reads += 1;
    else continue;
    if (r.visitor_id) a.people.add(r.visitor_id);
  }

  for (const r of (v.data ?? []) as { path: string; visitor_id: string | null }[]) {
    const id = idOf(r.path);
    if (!id) continue;
    const a = at(id);
    a.webViews += 1;
    if (r.visitor_id) a.people.add(r.visitor_id);
  }

  const by: Record<string, InsightStat> = {};
  const totals = { ...EMPTY };
  const everyone = new Set<string>();

  for (const [id, a] of acc) {
    by[id] = { reads: a.reads, webViews: a.webViews, people: a.people.size, shares: a.shares };
    totals.reads += a.reads;
    totals.webViews += a.webViews;
    totals.shares += a.shares;
    for (const p of a.people) everyone.add(p);
  }
  // Somebody who read four insights is one person, not four.
  totals.people = everyone.size;

  return { by, totals, ok: true };
}

/** "/insights/<uuid>" → "<uuid>". Anything else is not an insight. */
function idOf(path: string | null): string | null {
  const m = /^\/insights\/([0-9a-f-]{36})$/i.exec((path ?? "").split("?")[0]);
  return m ? m[1].toLowerCase() : null;
}
