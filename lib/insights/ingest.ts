import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchFeed } from "@/lib/insights/providers";

/**
 * One insights run.
 *
 * Deliberately the same shape as lib/jobs/ingest.ts: the work lives here
 * rather than in the route because there are two ways to start it — the cron
 * and a hand-triggered call — and two copies of this would drift.
 *
 * Written to survive a bad day. One feed being down must not cost the others,
 * so each source is fetched, written and committed on its own, and its
 * outcome is recorded on its own row whether it succeeded or not. Sources are
 * taken oldest-run-first in a bounded batch, which means a run cut off halfway
 * leaves the next run a sensible place to start rather than making it repeat
 * the same eight feeds forever.
 */

export type SourceReport = {
  source: string;
  ok: boolean;
  found?: number;
  written?: number;
  error?: string;
};

export type InsightsIngestResult = {
  ok: boolean;
  sources: number;
  written: number;
  report: SourceReport[];
  note?: string;
};

/** Enough to finish inside a serverless function's time budget. */
export const SOURCES_PER_RUN = 8;

type SourceRow = {
  id: string;
  name: string;
  feed_url: string;
  kind: string;
};

export async function runInsightsIngest(
  db: SupabaseClient,
): Promise<InsightsIngestResult> {
  const { data, error } = await db
    .from("insight_sources")
    .select("id, name, feed_url, kind")
    .eq("is_active", true)
    // Nulls first: a source that has never run has waited longest.
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(SOURCES_PER_RUN);

  if (error) {
    return { ok: false, sources: 0, written: 0, report: [], note: error.message };
  }

  const sources = (data ?? []) as SourceRow[];
  if (sources.length === 0) {
    return { ok: true, sources: 0, written: 0, report: [], note: "No active sources" };
  }

  const report: SourceReport[] = [];
  let written = 0;

  for (const source of sources) {
    const result = await fetchFeed(source.feed_url);
    const ranAt = new Date().toISOString();

    if (!result.ok) {
      await db
        .from("insight_sources")
        .update({
          last_run_at: ranAt,
          last_status: "error",
          last_error: result.error.slice(0, 500),
          updated_at: ranAt,
        })
        .eq("id", source.id);

      report.push({ source: source.name, ok: false, error: result.error });
      continue;
    }

    const rows = result.items.map((item) => ({
      source_id: source.id,
      external_id: item.externalId,
      kind: source.kind,
      title: item.title,
      summary: item.summary,
      url: item.url,
      image_url: item.imageUrl,
      source_name: source.name,
      published_at: item.publishedAt,
    }));

    // Upsert rather than insert: a feed republishes the same items every time
    // it is fetched, and the unique key on (source_id, external_id) turns the
    // repeats into updates. Corrections a publisher makes to a headline reach
    // us this way too, which an insert-and-ignore would miss.
    const { error: writeError } = await db
      .from("insights")
      .upsert(rows, { onConflict: "source_id,external_id" });

    if (writeError) {
      await db
        .from("insight_sources")
        .update({
          last_run_at: ranAt,
          last_status: "error",
          last_error: writeError.message.slice(0, 500),
          updated_at: ranAt,
        })
        .eq("id", source.id);

      report.push({ source: source.name, ok: false, error: writeError.message });
      continue;
    }

    await db
      .from("insight_sources")
      .update({
        last_run_at: ranAt,
        last_status: "ok",
        last_count: rows.length,
        last_error: null,
        updated_at: ranAt,
      })
      .eq("id", source.id);

    written += rows.length;
    report.push({
      source: source.name,
      ok: true,
      found: result.items.length,
      written: rows.length,
    });
  }

  return {
    // A run is a success if any source worked. All of them failing is the
    // signal worth alerting on; one flaky publisher is not.
    ok: report.some((r) => r.ok),
    sources: sources.length,
    written,
    report,
  };
}
