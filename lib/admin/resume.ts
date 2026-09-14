import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { templateById, TEMPLATES } from "@/lib/app/resume-templates";

/**
 * What the admin résumé tab reads.
 *
 * Service key, same as the rest of the admin screens, and the admin cookie has
 * already been checked twice before anything here runs.
 *
 * ------------------------------------------------------- two clocks, one fact
 *
 * Downloads are recorded twice and the difference matters enough to state at
 * the top of the file, because reading it backwards produces a chart that says
 * the product died last month.
 *
 * `resume_drafts.download_count` is a per-draft running total. It has been
 * incrementing since the builder shipped, so it is the **complete** history —
 * and it carries no dates at all, so it can never answer "this week".
 *
 * `account_events` rows (kind `resume_download`) are one line per download,
 * with a timestamp and the template. They can answer anything with a date on
 * it, and they begin the day the recorder shipped — so for a while they will
 * show far fewer downloads than the counters do. That is not a bug and the
 * screen has to say so, which is why `templateRows` reports both numbers side
 * by side rather than picking one.
 */

export type Missing = { ok: false; missing: string };
type Result<T> = { ok: true; data: T } | Missing;

function absent(message: string | undefined, file: string): Missing | null {
  if (!message) return null;
  return /does not exist|schema cache|relation .* does not exist/i.test(message)
    ? { ok: false as const, missing: file }
    : null;
}

const isoDaysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

/* ------------------------------------------------------------------ totals */

export type ResumeTotals = {
  /** Drafts that exist right now. */
  drafts: number;
  draftsLast7: number;
  /** People who have ever started one. */
  builders: number;
  /** All-time, from the per-draft counters. Includes pre-tracking downloads. */
  downloadsAllTime: number;
  /** Drafts that have been downloaded at least once. */
  draftsDownloaded: number;
  /** From the event rows, so: since tracking started. */
  downloadsLast7: number;
  downloadsLast28: number;
  /** Distinct people who downloaded in the last 28 days. */
  downloadersLast28: number;
  /** Whether any event row exists yet, so the screen can explain an empty half. */
  hasEvents: boolean;
};

export async function getResumeTotals(): Promise<Result<ResumeTotals>> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "20_app_accounts.sql" };

  const drafts = await db
    .from("resume_drafts")
    .select("user_id,download_count,created_at");
  const gone = absent(drafts.error?.message, "50_resume_drafts.sql");
  if (gone) return gone;

  const rows = (drafts.data ?? []) as {
    user_id: string;
    download_count: number | null;
    created_at: string;
  }[];

  const week = isoDaysAgo(7);
  const totals = rows.reduce(
    (acc, r) => {
      const n = Number(r.download_count ?? 0);
      acc.downloadsAllTime += n;
      if (n > 0) acc.draftsDownloaded += 1;
      if (r.created_at >= week) acc.draftsLast7 += 1;
      acc.people.add(r.user_id);
      return acc;
    },
    { downloadsAllTime: 0, draftsDownloaded: 0, draftsLast7: 0, people: new Set<string>() },
  );

  // The event half. A deployment that has not run 63_resume_events.sql still
  // has the table — only the index and the view are new — so this reads
  // `account_events` directly and degrades to zeroes rather than to an error.
  const events = await db
    .from("account_events")
    .select("user_id,created_at")
    .eq("kind", "resume_download")
    .gte("created_at", isoDaysAgo(28));

  const evRows = (events.data ?? []) as { user_id: string; created_at: string }[];
  const downloaders = new Set(evRows.map((e) => e.user_id));

  return {
    ok: true,
    data: {
      drafts: rows.length,
      draftsLast7: totals.draftsLast7,
      builders: totals.people.size,
      downloadsAllTime: totals.downloadsAllTime,
      draftsDownloaded: totals.draftsDownloaded,
      downloadsLast7: evRows.filter((e) => e.created_at >= week).length,
      downloadsLast28: evRows.length,
      downloadersLast28: downloaders.size,
      hasEvents: evRows.length > 0,
    },
  };
}

/* --------------------------------------------------------------- templates */

export type TemplateRow = {
  id: string;
  /** The template's display name, or the raw id if it is no longer in the list. */
  name: string;
  layout: string | null;
  /** Drafts started on this template. */
  drafts: number;
  /** All-time downloads, summed from the per-draft counters. */
  downloads: number;
  /** Downloads in the last 28 days, from the event rows. */
  recent: number;
  /** Share of all-time downloads, 0–1. */
  share: number;
};

/**
 * Which templates people actually download.
 *
 * Every template that has been *used* appears, including ids that are no
 * longer in `TEMPLATES` — somebody's draft still exists on a template that has
 * since been renamed or removed, and dropping those rows would quietly make
 * the totals not add up. Unknown ids keep their raw id as the name so it is
 * obvious what happened.
 *
 * Sorted by all-time downloads, not by drafts. A template people start on and
 * abandon is a worse template than one they start on less and finish more, and
 * the download is the finish.
 */
export async function getTemplateRows(): Promise<Result<TemplateRow[]>> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "20_app_accounts.sql" };

  const drafts = await db.from("resume_drafts").select("template,download_count");
  const gone = absent(drafts.error?.message, "50_resume_drafts.sql");
  if (gone) return gone;

  const events = await db
    .from("account_events")
    .select("detail")
    .eq("kind", "resume_download")
    .gte("created_at", isoDaysAgo(28));

  const recentByTemplate = new Map<string, number>();
  for (const e of (events.data ?? []) as { detail: { template?: string | null } }[]) {
    const t = e.detail?.template ?? "unknown";
    recentByTemplate.set(t, (recentByTemplate.get(t) ?? 0) + 1);
  }

  const agg = new Map<string, { drafts: number; downloads: number }>();
  for (const r of (drafts.data ?? []) as { template: string | null; download_count: number | null }[]) {
    const id = r.template ?? "unknown";
    const cur = agg.get(id) ?? { drafts: 0, downloads: 0 };
    cur.drafts += 1;
    cur.downloads += Number(r.download_count ?? 0);
    agg.set(id, cur);
  }
  // A template nobody has touched is still worth seeing as a zero: "nine
  // designs have never once been downloaded" is the most useful sentence this
  // table can say, and it cannot say it if those rows are absent.
  for (const t of TEMPLATES) if (!agg.has(t.id)) agg.set(t.id, { drafts: 0, downloads: 0 });

  const total = [...agg.values()].reduce((n, v) => n + v.downloads, 0);

  const rows: TemplateRow[] = [...agg.entries()].map(([id, v]) => {
    const known = TEMPLATES.some((t) => t.id === id);
    const t = templateById(id);
    return {
      id,
      name: known ? t.name : id,
      layout: known ? t.layout : null,
      drafts: v.drafts,
      downloads: v.downloads,
      recent: recentByTemplate.get(id) ?? 0,
      share: total ? v.downloads / total : 0,
    };
  });

  rows.sort((a, b) => b.downloads - a.downloads || b.drafts - a.drafts || a.name.localeCompare(b.name));
  return { ok: true, data: rows };
}

/* ------------------------------------------------------------ recent + who */

export type DownloadRow = {
  at: string;
  userId: string;
  who: string;
  /** The address they signed in with. Null for a phone-only account. */
  email: string | null;
  phone: string | null;
  templateId: string | null;
  templateName: string | null;
  title: string | null;
};

/** The last downloads, newest first, with a name attached where there is one. */
export async function getRecentDownloads(limit = 50): Promise<Result<DownloadRow[]>> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "20_app_accounts.sql" };

  const events = await db
    .from("account_events")
    .select("user_id,created_at,detail")
    .eq("kind", "resume_download")
    .order("created_at", { ascending: false })
    .limit(limit);
  const gone = absent(events.error?.message, "20_app_accounts.sql");
  if (gone) return gone;

  const rows = (events.data ?? []) as {
    user_id: string;
    created_at: string;
    detail: { template?: string | null; title?: string | null };
  }[];
  if (!rows.length) return { ok: true, data: [] };

  // One lookup for the names rather than one per row.
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const people = await db.from("profiles").select("id,full_name,email,phone").in("id", ids);
  const byId = new Map(
    ((people.data ?? []) as Person[]).map((p) => [p.id, p]),
  );

  return {
    ok: true,
    data: rows.map((r) => {
      const id = r.detail?.template ?? null;
      const known = id ? TEMPLATES.some((t) => t.id === id) : false;
      const p = byId.get(r.user_id);
      return {
        at: r.created_at,
        userId: r.user_id,
        who: p?.full_name || p?.email || p?.phone || r.user_id.slice(0, 8),
        email: p?.email ?? null,
        phone: p?.phone ?? null,
        templateId: id,
        templateName: id ? (known ? templateById(id).name : id) : null,
        title: r.detail?.title ?? null,
      };
    }),
  };
}

/* ---------------------------------------------------- every résumé, by whom */

type Person = { id: string; full_name: string | null; email: string | null; phone: string | null };

export type ResumeRow = {
  id: string;
  userId: string;
  name: string | null;
  /** Null for a phone-only account — see the note on `getResumeList`. */
  email: string | null;
  phone: string | null;
  title: string | null;
  templateId: string | null;
  templateName: string | null;
  downloads: number;
  createdAt: string;
  lastDownloadedAt: string | null;
  isPublic: boolean;
};

/**
 * Every résumé, with the address of whoever made it.
 *
 * The aggregate table above answers "which templates win"; this answers the
 * flatter question underneath it — *who is building what.*
 *
 * ------------------------------------------------------------------ the modes
 *
 * Never all of them at once by default, because "every résumé ever" is a list
 * with no question attached to it. Two segments, and they are different jobs:
 *
 *   `downloaded` — somebody finished. Ordered by when they last downloaded,
 *                  so the top of the list is what is happening now.
 *   `building`   — started and never downloaded. This is the useful one: it is
 *                  the list of people the product half-worked for, and it is
 *                  the only list here anybody can act on.
 *
 * The split is done in the query rather than by filtering the results,
 * because those are not the same thing. Fetching the newest 300 and then
 * keeping the downloaded ones gives you "the downloaded résumés among the 300
 * newest" — which on a busy week is a handful of rows and looks like nobody
 * is downloading anything. The limit has to apply *after* the predicate.
 *
 * `download_count` is null on rows written before the column existed, and null
 * means never downloaded — so `building` has to ask for null *or* zero, and
 * `downloaded` uses `gt 0`, which excludes null for free.
 *
 * ------------------------------------------------------- the email may be null
 *
 * Every row has an owner; not every owner has an email address. There are two
 * ways into this product and only one of them involves one: Google hands over
 * an address, phone OTP hands over a number, and `handle_new_user()` copies
 * across whichever `auth.users` was given. A phone account's `email` is null
 * and always will be — the trigger fires once, on insert, so even linking
 * Google later leaves the original null in place.
 *
 * So `email` is returned honestly as null rather than filled in with the
 * phone number. A column headed "email" that sometimes contains a mobile
 * number is worse than an empty cell: it silently corrupts anything anybody
 * ever exports from it, and it hides the thing actually worth knowing, which
 * is how much of the audience never gives an address at all.
 */
export type ResumeMode = "downloaded" | "building" | "all";

export async function getResumeList(
  mode: ResumeMode = "downloaded",
  limit = 200,
): Promise<Result<ResumeRow[]>> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "20_app_accounts.sql" };

  const cols = "id,user_id,title,template,download_count,created_at,last_downloaded_at,is_public";
  let q = db.from("resume_drafts").select(cols);

  if (mode === "downloaded") {
    // Ordered by the download, not by when the draft was started: this list is
    // about activity, and a résumé begun in March and downloaded today belongs
    // at the top of it.
    q = q.gt("download_count", 0).order("last_downloaded_at", { ascending: false });
  } else if (mode === "building") {
    q = q.or("download_count.is.null,download_count.eq.0").order("created_at", { ascending: false });
  } else {
    q = q.order("created_at", { ascending: false });
  }

  const drafts = await q.limit(limit);
  const gone = absent(drafts.error?.message, "50_resume_drafts.sql");
  if (gone) return gone;

  const rows = (drafts.data ?? []) as {
    id: string;
    user_id: string;
    title: string | null;
    template: string | null;
    download_count: number | null;
    created_at: string;
    last_downloaded_at: string | null;
    is_public: boolean | null;
  }[];
  if (!rows.length) return { ok: true, data: [] };

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const people = await db.from("profiles").select("id,full_name,email,phone").in("id", ids);
  const byId = new Map(((people.data ?? []) as Person[]).map((p) => [p.id, p]));

  return {
    ok: true,
    data: rows.map((r) => {
      const p = byId.get(r.user_id);
      const known = r.template ? TEMPLATES.some((t) => t.id === r.template) : false;
      return {
        id: r.id,
        userId: r.user_id,
        name: p?.full_name ?? null,
        email: p?.email ?? null,
        phone: p?.phone ?? null,
        title: r.title,
        templateId: r.template,
        templateName: r.template ? (known ? templateById(r.template).name : r.template) : null,
        downloads: Number(r.download_count ?? 0),
        createdAt: r.created_at,
        lastDownloadedAt: r.last_downloaded_at,
        isPublic: Boolean(r.is_public),
      };
    }),
  };
}

/**
 * How reachable the people building résumés actually are.
 *
 * Counted rather than assumed, because it decides whether "email the people
 * who built a résumé but never downloaded it" is a campaign or a wish.
 */
export type Reach = { withEmail: number; phoneOnly: number; neither: number };

export function reachOf(rows: ResumeRow[]): Reach {
  const seen = new Map<string, ResumeRow>();
  for (const r of rows) if (!seen.has(r.userId)) seen.set(r.userId, r);
  let withEmail = 0;
  let phoneOnly = 0;
  let neither = 0;
  for (const r of seen.values()) {
    if (r.email) withEmail += 1;
    else if (r.phone) phoneOnly += 1;
    else neither += 1;
  }
  return { withEmail, phoneOnly, neither };
}

/* ----------------------------------------------------------- other signals */

export type ResumeSignals = {
  /** Uploaded résumés — the ATS checker's saved scans. */
  uploads: number;
  uploadsLast7: number;
  /** Average ATS score across uploads that have one. */
  avgScore: number | null;
  scored: number;
  /** Drafts made public with a share link. */
  shared: number;
  /** Drafts that have a design — that is, have been opened in the editor. */
  designed: number;
  /** Every other kind of account event, counted, so nothing is invisible. */
  otherEvents: { kind: string; count: number }[];
};

/**
 * The rest of what is measurable about résumés today.
 *
 * Deliberately a list of what the tables already know rather than a wish list.
 * Each of these is one column that is already being written by the product;
 * none of them needed a new recorder, which is why they cover all of history
 * instead of starting from today.
 */
export async function getResumeSignals(): Promise<Result<ResumeSignals>> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "20_app_accounts.sql" };

  const week = isoDaysAgo(7);

  const [uploads, drafts, events] = await Promise.all([
    db.from("resumes").select("ats_score,created_at"),
    db.from("resume_drafts").select("is_public,design"),
    db.from("account_events").select("kind"),
  ]);

  const gone = absent(uploads.error?.message, "20_app_accounts.sql");
  if (gone) return gone;

  const up = (uploads.data ?? []) as { ats_score: number | null; created_at: string }[];
  const scores = up.map((u) => u.ats_score).filter((s): s is number => typeof s === "number");

  const dr = (drafts.data ?? []) as { is_public: boolean | null; design: unknown }[];

  const kinds = new Map<string, number>();
  for (const e of (events.data ?? []) as { kind: string }[]) {
    if (e.kind === "resume_download") continue; // counted properly above
    kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
  }

  return {
    ok: true,
    data: {
      uploads: up.length,
      uploadsLast7: up.filter((u) => u.created_at >= week).length,
      avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      scored: scores.length,
      shared: dr.filter((d) => d.is_public).length,
      designed: dr.filter((d) => d.design != null).length,
      otherEvents: [...kinds.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}
