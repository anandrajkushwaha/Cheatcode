import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchBoard, fetchSearch, type Provider } from "@/lib/jobs/providers";

/**
 * One ingestion run.
 *
 * Lives here rather than in the route because there are two ways to start it —
 * the nightly cron, and the "Sync now" button in the dashboard — and a second
 * copy of this logic would drift from the first within a week.
 *
 * Written to survive a bad day: one board being down must not cost the other
 * twenty, and a run cut off halfway must leave the database in a state the
 * next run can pick up from. Both follow from processing sources oldest-first,
 * in a bounded batch, committing each one on its own.
 */

export type SourceReport = {
  company: string;
  provider: string;
  ok: boolean;
  found?: number;
  written?: number;
  retired?: number;
  error?: string;
};

export type IngestResult = {
  ok: boolean;
  sources: number;
  written: number;
  retired: number;
  report: SourceReport[];
  note?: string;
};

/** Enough to finish inside a serverless function's time budget. */
export const SOURCES_PER_RUN = 8;

type SourceRow = {
  id: string;
  provider: Provider;
  token: string;
  company_name: string;
  search_query: string | null;
  search_country: string | null;
  search_remote: boolean | null;
};

/**
 * How many saved JSearch queries one run is allowed to spend.
 *
 * Company boards are free and unlimited; JSearch is 200 requests a month on
 * the free tier, which is about six a day. The cap lives here rather than in
 * the schedule because it is a budget, not a preference — exceed it and the
 * month simply stops working on the 12th. Raise it with the env var the day
 * the plan is raised.
 */
const JSEARCH_PER_RUN = Math.max(
  0,
  Math.min(50, Number(process.env.JSEARCH_QUERIES_PER_RUN ?? 6) || 6),
);

/**
 * How long an aggregated job survives without being seen again. Six weeks is
 * past the point where an Indian posting is usually still live, and well past
 * the rotation gap between two runs of the same query.
 */
const STALE_SEARCH_DAYS = 45;

export async function runIngest(
  db: SupabaseClient,
  opts: { limit?: number; sourceId?: string } = {},
): Promise<IngestResult> {
  let query = db
    .from("job_sources")
    .select("id,provider,token,company_name,search_query,search_country,search_remote")
    .eq("is_active", true);

  if (opts.sourceId) {
    query = query.eq("id", opts.sourceId);
  } else {
    // Nulls first, so a board added a minute ago is picked up on the next run
    // rather than waiting behind everything already fetched.
    query = query
      .order("last_run_at", { ascending: true, nullsFirst: true })
      .limit((opts.limit ?? SOURCES_PER_RUN) + JSEARCH_PER_RUN);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, sources: 0, written: 0, retired: 0, report: [], note: error.message };
  }

  const all = (data ?? []) as SourceRow[];

  // Queries are rotated and rationed; boards are not. Both lists already come
  // back oldest-first, so over a week every saved query gets its turn.
  const boards = all.filter((s) => s.provider !== "jsearch");
  const queries = all.filter((s) => s.provider === "jsearch").slice(0, JSEARCH_PER_RUN);
  const sources = [...boards, ...queries];

  if (!sources.length) {
    return { ok: true, sources: 0, written: 0, retired: 0, report: [], note: "No active boards." };
  }

  const startedAt = new Date().toISOString();
  const report: SourceReport[] = [];

  for (const source of sources) {
    const result =
      source.provider === "jsearch"
        ? await fetchSearch({
            query: source.search_query ?? "",
            country: source.search_country,
            remote: source.search_remote ?? false,
          })
        : await fetchBoard(source.provider, source.token, source.company_name);

    if (!result.ok) {
      await db
        .from("job_sources")
        .update({
          last_run_at: new Date().toISOString(),
          last_status: "error",
          last_error: result.error.slice(0, 400),
        })
        .eq("id", source.id);
      report.push({
        company: source.company_name,
        provider: source.provider,
        ok: false,
        error: result.error,
      });
      continue;
    }

    const rows = result.jobs.map((j) => ({
      source_id: source.id,
      ...j,
      // Deliberately not setting first_seen_at: on conflict Postgres updates
      // only the columns present here, so the original stays put and "posted
      // 3 weeks ago" keeps meaning something.
      last_seen_at: new Date().toISOString(),
      is_active: true,
      closed_at: null,
    }));

    let written = 0;
    let writeError: string | undefined;

    // Chunked because one board can carry several hundred roles, and a single
    // enormous statement is the thing most likely to time out.
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error: upsertError } = await db
        .from("jobs")
        .upsert(chunk, { onConflict: "provider,external_id" });
      if (upsertError) {
        writeError = upsertError.message;
        break;
      }
      written += chunk.length;
    }

    // Retirement means two different things depending on the source.
    //
    // A company board is the whole truth: a job missing from the feed has been
    // taken down. A saved search is one page of Google's ranking, which
    // reshuffles between runs — a job absent today is usually still open, and
    // retiring it would empty the list within a week. So searches expire by
    // age instead, and only after long enough that the posting is stale
    // anyway. Marked closed rather than deleted either way: somebody may have
    // applied, and a dead link beats a missing page.
    let retired = 0;
    if (!writeError) {
      const cutoff =
        source.provider === "jsearch"
          ? new Date(Date.now() - STALE_SEARCH_DAYS * 86_400_000).toISOString()
          : startedAt;

      const { data: closed } = await db
        .from("jobs")
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq("source_id", source.id)
        .eq("is_active", true)
        .lt("last_seen_at", cutoff)
        .select("id");
      retired = closed?.length ?? 0;
    }

    await db
      .from("job_sources")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: writeError ? "error" : "ok",
        last_count: written,
        last_error: writeError ? writeError.slice(0, 400) : null,
      })
      .eq("id", source.id);

    report.push({
      company: source.company_name,
      provider: source.provider,
      ok: !writeError,
      found: result.jobs.length,
      written,
      retired,
      error: writeError,
    });
  }

  return {
    ok: report.every((r) => r.ok),
    sources: report.length,
    written: report.reduce((n, r) => n + (r.written ?? 0), 0),
    retired: report.reduce((n, r) => n + (r.retired ?? 0), 0),
    report,
  };
}
