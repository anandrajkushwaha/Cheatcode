import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { harvest } from "@/lib/govt/harvest";
import { classify, type Classified } from "@/lib/govt/classify";
import { KIND_SLUG, NOTICE_KINDS, makeSlug } from "@/lib/govt/types";

const KIND_SLUGS = NOTICE_KINDS.map((k) => KIND_SLUG[k]);

/**
 * One morning's run of the government-jobs monitor.
 *
 * Once a day, early, and every board in the one run — because recruitment
 * notifications do not arrive hourly and checking ten boards around the clock
 * is work nobody asked for.
 *
 * Boards are taken least-recently-checked first and worked through until the
 * time budget runs out. That ordering is what makes the budget safe: whatever
 * is not reached today is at the front of the queue tomorrow, so a slow board
 * delays the others by a day rather than starving them forever. Most mornings
 * the budget is never reached — a board whose links have not changed stops at
 * the hash, costing one render and no model call at all.
 *
 * Nothing waits for a person. What the run cannot stand behind, it leaves out
 * — see the field rules in 100_govt_notices.sql — and what it publishes is a
 * title, a date and a link to the board's own page, which is the part it can
 * read directly and the part a reader actually needs.
 */

export type SourceResult = {
  source: string;
  checked: number;
  found: number;
  added: number;
  status: "ok" | "empty" | "unchanged" | "error";
  error?: string;
  /** Set when the board was read by pattern because the model call failed. */
  note?: string;
};

export type RunResult = {
  ok: boolean;
  /** Boards read this morning, in the order they were taken. */
  sources: SourceResult[];
  added: number;
  /** Boards left for tomorrow because the budget ran out. */
  remaining: number;
  error?: string;
};

/**
 * Stop starting new boards past this. One is always finished, never cut off.
 *
 * Eighty, under a 120-second function, so that a board started at 79 seconds
 * and timing out at its own twenty still lands inside the limit. A budget that
 * can overrun is worse than a tight one: the run is killed mid-board, the
 * stamp is never written, and that board looks untouched tomorrow.
 */
const BUDGET_MS = 80_000;

export async function runGovtIngest(db: SupabaseClient): Promise<RunResult> {
  const started = Date.now();

  const { data, error } = await db
    .from("govt_sources")
    .select("id, name, organisation, organisation_type, list_url, last_hash")
    .eq("active", true)
    .not("list_url", "is", null)
    .order("last_run_at", { ascending: true, nullsFirst: true });

  if (error) return { ok: false, sources: [], added: 0, remaining: 0, error: error.message };

  type Row = {
    id: string;
    name: string;
    organisation: string;
    organisation_type: string;
    list_url: string;
    last_hash: string | null;
  };

  const queue = (data ?? []) as Row[];
  const done: SourceResult[] = [];

  for (const source of queue) {
    if (Date.now() - started > BUDGET_MS) break;
    done.push(await one(db, source));
  }

  const added = done.reduce((n, d) => n + d.added, 0);
  if (added > 0) refresh();

  return {
    ok: done.every((d) => d.status !== "error"),
    sources: done,
    added,
    remaining: queue.length - done.length,
  };
}

/**
 * Throw away the cached pages, now that there is something new on them.
 *
 * Without this the ingest works perfectly and nobody can tell. These pages
 * are rendered once at build time and then re-rendered on a ten-minute timer,
 * so a run that publishes eleven notices at 7:02 leaves /government-jobs
 * serving the empty page it was built with — and the empty state says
 * "nothing published yet", which is exactly the wrong thing to be telling
 * somebody when eleven notices have just landed.
 *
 * Called only when something was actually added. A quiet morning should not
 * throw away a perfectly good cached page for nothing.
 */
function refresh(): void {
  try {
    revalidatePath("/government-jobs");
    for (const slug of KIND_SLUGS) revalidatePath(`/government-jobs/${slug}`);
    revalidatePath("/sitemap.xml");
  } catch {
    // revalidatePath needs a request context, and there are callers — a
    // script, a test — that have none. A cache that stays warm a few minutes
    // longer is not worth failing a run that otherwise succeeded over.
  }
}

/** One board, start to finish. Never throws: a bad board is a row, not a 500. */
async function one(
  db: SupabaseClient,
  source: {
    id: string;
    name: string;
    organisation: string;
    organisation_type: string;
    list_url: string;
    last_hash: string | null;
  },
): Promise<SourceResult> {
  const stamp = async (patch: Record<string, unknown>) => {
    await db
      .from("govt_sources")
      .update({ last_run_at: new Date().toISOString(), ...patch })
      .eq("id", source.id);
  };

  try {
    const page = await harvest(source.list_url);

    // Nothing has changed since last time. The common case by far, and the
    // reason checking ten boards every hour costs almost nothing.
    if (page.hash === source.last_hash) {
      await stamp({ last_status: "unchanged", last_error: null });
      return {
        source: source.organisation,
        checked: page.links.length,
        found: 0,
        added: 0,
        status: "unchanged",
      };
    }

    const result = await classify(page.title, page.links);
    if (!result.ok) {
      await stamp({ last_status: "error", last_error: result.error.slice(0, 500) });
      return {
        source: source.organisation,
        checked: page.links.length,
        found: 0,
        added: 0,
        status: "error",
        error: result.error,
      };
    }

    let added = 0;
    for (const notice of result.notices) {
      if (await store(db, source, notice)) added++;
    }

    await stamp({
      last_status: result.degraded ? "ok (no model)" : result.notices.length ? "ok" : "empty",
      last_count: result.notices.length,
      last_error: null,
      last_hash: page.hash,
    });

    return {
      source: source.organisation,
      checked: page.links.length,
      found: result.notices.length,
      added,
      status: result.notices.length ? "ok" : "empty",
      // Said out loud rather than hidden: these notices were read off the link
      // text because the model call failed, so they have no exam name and will
      // not have grouped onto a recruitment page.
      ...(result.degraded ? { note: `read without the model — ${result.degraded}` } : {}),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await stamp({ last_status: "error", last_error: message.slice(0, 500) });
    return {
      source: source.organisation,
      checked: 0,
      found: 0,
      added: 0,
      status: "error",
      error: message,
    };
  }
}

/* ------------------------------------------------------------------ store */

type Source = { id: string; organisation: string; organisation_type: string };

/**
 * Write one notice, and the recruitment it belongs to.
 *
 * Every notice gets an exam, always. When none can be matched, one is minted
 * from what the notice itself says — because a notice with no exam has no
 * page to live on, and a reader arriving from a search for "SSC CGL result"
 * should land somewhere that also knows when the exam is. The next notice
 * from the same recruitment finds that row and attaches to it, so the page
 * fills out on its own over the months.
 */
async function store(db: SupabaseClient, source: Source, notice: Classified): Promise<boolean> {
  // Seen before. `official_url` is unique, so this is also what stops a board
  // that re-lists last month's notices from publishing them twice.
  const { data: seen } = await db
    .from("govt_notices")
    .select("id")
    .eq("official_url", notice.url)
    .maybeSingle();

  if (seen) {
    await db
      .from("govt_notices")
      .update({ last_seen_at: new Date().toISOString(), status: "published" })
      .eq("id", (seen as { id: string }).id);
    return false;
  }

  const examId = await findOrMintExam(db, source, notice);

  const { error } = await db.from("govt_notices").insert({
    exam_id: examId,
    source_id: source.id,
    kind: notice.kind,
    title: notice.title,
    published_on: notice.publishedOn,
    official_url: notice.url,
    status: "published",
    last_seen_at: new Date().toISOString(),
  });

  // A unique violation here is two links to the same document in one run,
  // which is normal on these pages and not worth reporting as a failure.
  return !error;
}

async function findOrMintExam(
  db: SupabaseClient,
  source: Source,
  notice: Classified,
): Promise<string | null> {
  const name = notice.examName || notice.title;
  const slug = makeSlug(source.organisation, name, notice.year);
  if (!slug) return null;

  const { data: found } = await db
    .from("govt_exams")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (found) return (found as { id: string }).id;

  const { data: made, error } = await db
    .from("govt_exams")
    .insert({
      slug,
      organisation: source.organisation,
      organisation_type: source.organisation_type,
      name,
      year: notice.year,
      status: "published",
      // No evidence recorded, deliberately: nothing here was read from a
      // notification, so the page shows the name and the notices and states
      // nothing it cannot support. Dates and vacancies arrive when the
      // notification itself is read.
      evidence: {},
    })
    .select("id")
    .maybeSingle();

  if (error || !made) return null;
  return (made as { id: string }).id;
}
