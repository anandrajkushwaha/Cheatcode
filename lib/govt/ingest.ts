import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { harvest } from "@/lib/govt/harvest";
import { classify, type Classified } from "@/lib/govt/classify";
import { makeSlug } from "@/lib/govt/types";

/**
 * One run of the government-jobs monitor.
 *
 * **One board per invocation**, least recently run first. Not a loop over all
 * ten, because each board means starting Chrome, rendering a page and a model
 * call, and ten of those do not fit inside a serverless function's minute. A
 * board that hangs then takes down the nine behind it, which is how a monitor
 * stops monitoring without anybody noticing. One at a time, every hour, means
 * ten boards are each checked a little over twice a day and no single bad page
 * can starve the others.
 *
 * Nothing waits for a person. What the run cannot stand behind, it leaves out
 * — see the field rules in 100_govt_notices.sql — and what it publishes is a
 * title, a date and a link to the board's own page, which is the part it can
 * read directly and the part a reader actually needs.
 */

export type RunResult = {
  ok: boolean;
  source?: string;
  checked: number;
  found: number;
  added: number;
  skipped?: "unchanged" | "none-active";
  error?: string;
};

export async function runGovtIngest(db: SupabaseClient): Promise<RunResult> {
  const { data: sources, error } = await db
    .from("govt_sources")
    .select("id, name, organisation, organisation_type, list_url, last_hash")
    .eq("active", true)
    .not("list_url", "is", null)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(1);

  if (error) return { ok: false, checked: 0, found: 0, added: 0, error: error.message };

  const source = (sources ?? [])[0] as
    | {
        id: string;
        name: string;
        organisation: string;
        organisation_type: string;
        list_url: string;
        last_hash: string | null;
      }
    | undefined;

  if (!source) return { ok: true, checked: 0, found: 0, added: 0, skipped: "none-active" };

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
        ok: true,
        source: source.organisation,
        checked: page.links.length,
        found: 0,
        added: 0,
        skipped: "unchanged",
      };
    }

    const result = await classify(page.title, page.links);
    if (!result.ok) {
      await stamp({ last_status: "error", last_error: result.error.slice(0, 500) });
      return { ok: false, source: source.organisation, checked: page.links.length, found: 0, added: 0, error: result.error };
    }

    let added = 0;
    for (const notice of result.notices) {
      if (await store(db, source, notice)) added++;
    }

    await stamp({
      last_status: result.notices.length ? "ok" : "empty",
      last_count: result.notices.length,
      last_error: null,
      last_hash: page.hash,
    });

    return {
      ok: true,
      source: source.organisation,
      checked: page.links.length,
      found: result.notices.length,
      added,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await stamp({ last_status: "error", last_error: message.slice(0, 500) });
    return { ok: false, source: source.organisation, checked: 0, found: 0, added: 0, error: message };
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
