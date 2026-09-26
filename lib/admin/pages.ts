import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalPath, getInventory, type InventoryPage, type PageGroup } from "@/lib/admin/inventory";
import type { Range } from "@/lib/admin/range";

/**
 * Page by page: who arrived, how far they read, and whether they passed it on.
 *
 * Every other screen in here ranks what is already working — the top ten
 * pages, the top ten sources. That shape cannot answer the question this one
 * exists for, which is which pages get nothing, because a page with no views
 * is absent from the data rather than at the bottom of it. So the inventory
 * comes first and the visits are joined onto it, not the other way round.
 *
 * The aggregation runs here rather than in Postgres deliberately: it needs no
 * new SQL function, so the screen works the moment it deploys instead of
 * waiting on a migration being run by hand.
 */

export type PageStat = InventoryPage & {
  views: number;
  people: number;
  /** Visits that began on this page — traffic arriving, not clicking through. */
  entries: number;
  /** Average furthest scroll, as a percentage. Null when nobody scrolled. */
  readThrough: number | null;
  /** Median seconds on the page. Null when nothing was recorded. */
  seconds: number | null;
  shares: number;
  sources: { source: string; views: number }[];
  lastSeen: string | null;
  /** True when this page is not in the inventory — a URL we did not expect. */
  unknown?: boolean;
};

export type PagesReport = {
  articles: PageStat[];
  insights: PageStat[];
  pages: PageStat[];
  /** Published content with no views at all in this window. */
  unseen: PageStat[];
  totals: { pages: number; withViews: number; withoutViews: number; shares: number };
  /** True when the window held more rows than we read — numbers are a floor. */
  truncated: boolean;
};

const ROW_LIMIT = 50_000;

export async function getPages(
  range: Range,
): Promise<{ ok: true; data: PagesReport } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Supabase isn't configured." };

  const since = range.from ?? new Date(Date.now() - range.days * 86_400_000).toISOString();
  const until = range.to ?? null;

  let views = db
    .from("page_views")
    .select("path,session_id,visitor_id,source,created_at")
    .eq("is_bot", false)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(ROW_LIMIT);
  if (until) views = views.lte("created_at", until);

  let events = db
    .from("page_events")
    .select("event,path,label,value,session_id,visitor_id,location")
    .eq("is_bot", false)
    .in("event", ["scroll_depth", "time_on_page", "content_share", "article_view"])
    .gte("created_at", since)
    .limit(ROW_LIMIT);
  if (until) events = events.lte("created_at", until);

  const [inventory, v, e] = await Promise.all([getInventory(), views, events]);
  if (v.error) return { ok: false, error: v.error.message };

  type Agg = {
    views: number;
    people: Set<string>;
    sessions: Set<string>;
    entries: number;
    sources: Map<string, number>;
    lastSeen: string | null;
    /** Furthest scroll reached per session, so one reader counts once. */
    depth: Map<string, number>;
    seconds: Map<string, number>;
    shares: number;
  };

  const agg = new Map<string, Agg>();
  const blank = (): Agg => ({
    views: 0,
    people: new Set(),
    sessions: new Set(),
    entries: 0,
    sources: new Map(),
    lastSeen: null,
    depth: new Map(),
    seconds: new Map(),
    shares: 0,
  });
  const at = (path: string) => {
    let a = agg.get(path);
    if (!a) agg.set(path, (a = blank()));
    return a;
  };

  // ---------- visits ----------
  // Rows arrive oldest first, so the first path seen for a session is that
  // visit's landing page. That is what "entries" counts: arrivals, as opposed
  // to pages reached by clicking around once already here.
  const sessionStarted = new Set<string>();
  const rows = (v.data ?? []) as {
    path: string;
    session_id: string | null;
    visitor_id: string | null;
    source: string | null;
    created_at: string;
  }[];

  for (const r of rows) {
    const path = canonicalPath(r.path);
    const a = at(path);
    a.views += 1;
    if (r.visitor_id) a.people.add(r.visitor_id);
    if (r.session_id) {
      a.sessions.add(r.session_id);
      if (!sessionStarted.has(r.session_id)) {
        sessionStarted.add(r.session_id);
        a.entries += 1;
      }
    }
    const src = r.source || "direct";
    a.sources.set(src, (a.sources.get(src) ?? 0) + 1);
    if (!a.lastSeen || r.created_at > a.lastSeen) a.lastSeen = r.created_at;
  }

  // ---------- reading and sharing ----------
  if (!e.error) {
    for (const r of (e.data ?? []) as {
      event: string;
      path: string | null;
      label: string | null;
      value: number | null;
      session_id: string | null;
      visitor_id: string | null;
      location: string | null;
    }[]) {
      // scroll_depth and time_on_page carry the path they belong to in
      // `label`; content_share puts the shared path there too. `path` is the
      // page in the address bar, which for a share from a feed is not the
      // page being shared.
      const path = canonicalPath(r.label || r.path || "");
      const a = at(path);
      const key = r.session_id ?? `anon-${a.views}`;

      if (r.event === "scroll_depth") {
        const pct = Number(r.value ?? 0);
        if (pct > 0) a.depth.set(key, Math.max(a.depth.get(key) ?? 0, pct));
      } else if (r.event === "time_on_page") {
        const s = Number(r.value ?? 0);
        // time_on_page is reported in slices; a session's slices add up to
        // the time it actually spent.
        if (s > 0 && s < 3600) a.seconds.set(key, (a.seconds.get(key) ?? 0) + s);
      } else if (r.event === "content_share") {
        a.shares += 1;
      } else if (r.event === "article_view" && r.location === "app-reader") {
        // An insight is read inside the app's reader, which never navigates
        // to /insights/<id> and so never records a page view. Without this
        // every insight reads zero no matter how many people scrolled it.
        // Only the in-app reader is counted here: a blog article fires
        // article_view as well, and there it would double the page view it
        // already has.
        a.views += 1;
        if (r.visitor_id) a.people.add(r.visitor_id);
        if (r.session_id) a.sessions.add(r.session_id);
      }
    }
  }

  // ---------- join ----------
  const known = new Set(inventory.map((p) => p.path));
  const stat = (p: InventoryPage, unknown = false): PageStat => {
    const a = agg.get(p.path) ?? blank();
    const depths = [...a.depth.values()];
    const times = [...a.seconds.values()].sort((x, y) => x - y);
    return {
      ...p,
      unknown: unknown || undefined,
      views: a.views,
      people: a.people.size,
      entries: a.entries,
      readThrough: depths.length ? Math.round(depths.reduce((s, d) => s + d, 0) / depths.length) : null,
      seconds: times.length ? times[Math.floor(times.length / 2)] : null,
      shares: a.shares,
      sources: [...a.sources.entries()]
        .map(([source, views]) => ({ source, views }))
        .sort((x, y) => y.views - x.views)
        .slice(0, 4),
      lastSeen: a.lastSeen,
    };
  };

  const all: PageStat[] = inventory.map((p) => stat(p));

  // Anything visited that the inventory does not know about. A redirect left
  // in place, a campaign URL, a route added without this list being updated —
  // all of them would otherwise be invisible on the one screen meant to show
  // every page.
  for (const [path, a] of agg) {
    if (known.has(path) || a.views === 0) continue;
    all.push(stat({ path, title: path, group: "Site" }, true));
  }

  const byViews = (x: PageStat, y: PageStat) => y.views - x.views || x.path.localeCompare(y.path);
  /**
   * Live means a reader could actually have reached it. Posts carry a status
   * enum whose only public value is 'published', and a post published_at a
   * future date is scheduled, not ignored — counting either as "nobody opened
   * this" would fill the list with pages that were never open to begin with.
   */
  const now = Date.now();
  const live = (p: PageStat) =>
    (p.status === undefined || p.status === "published") &&
    (!p.publishedAt || new Date(p.publishedAt).getTime() <= now);

  const articles = all.filter((p) => p.group === "Article").sort(byViews);
  const insights = all.filter((p) => p.group === "Insight").sort(byViews);
  const pages = all.filter((p) => p.group !== "Article" && p.group !== "Insight").sort(byViews);

  return {
    ok: true,
    data: {
      articles,
      insights,
      pages,
      unseen: all
        .filter((p) => p.views === 0 && live(p) && !p.unknown)
        .sort((x, y) => groupRank(x.group) - groupRank(y.group) || x.title.localeCompare(y.title)),
      totals: {
        pages: all.length,
        withViews: all.filter((p) => p.views > 0).length,
        withoutViews: all.filter((p) => p.views === 0 && live(p)).length,
        shares: all.reduce((s, p) => s + p.shares, 0),
      },
      truncated: rows.length >= ROW_LIMIT,
    },
  };
}

const ORDER: PageGroup[] = ["Article", "Insight", "Question bank", "Tool", "Site", "App"];
const groupRank = (g: PageGroup) => ORDER.indexOf(g);
