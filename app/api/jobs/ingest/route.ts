import { createAppAdminClient } from "@/lib/supabase/app";
import { fetchBoard, type Provider } from "@/lib/jobs/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pull every active board and write what came back.
 *
 * Runs on a schedule, so it is written to survive a bad day rather than to be
 * fast: one board being down must not cost the other twenty, and a run that
 * gets cut off halfway must leave the database in a state the next run can
 * pick up from. Both fall out of the same decision — sources are processed
 * oldest-first, in a bounded batch, and each one is committed on its own.
 */

/** Enough to finish inside the function's time budget with room to spare. */
const SOURCES_PER_RUN = 8;

export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const denied = authorise(request);
  if (denied) return denied;

  const db = createAppAdminClient();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured" }, { status: 503 });
  }

  const { data: sources, error: sourcesError } = await db
    .from("job_sources")
    .select("id,provider,token,company_name")
    .eq("is_active", true)
    // Nulls first, so a board added a minute ago is picked up on the next run
    // instead of waiting behind everything that has already been fetched.
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(SOURCES_PER_RUN);

  if (sourcesError) {
    return Response.json({ ok: false, error: sourcesError.message }, { status: 500 });
  }
  if (!sources?.length) {
    return Response.json({ ok: true, sources: 0, note: "No active boards to pull." });
  }

  const startedAt = new Date().toISOString();
  const report: {
    company: string;
    provider: string;
    ok: boolean;
    found?: number;
    written?: number;
    retired?: number;
    error?: string;
  }[] = [];

  for (const source of sources as {
    id: string;
    provider: Provider;
    token: string;
    company_name: string;
  }[]) {
    const result = await fetchBoard(source.provider, source.token, source.company_name);

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
      // Deliberately not setting first_seen_at: on conflict Postgres only
      // updates the columns present here, so the original stays put and
      // "posted 3 weeks ago" keeps meaning something.
      last_seen_at: new Date().toISOString(),
      is_active: true,
      closed_at: null,
    }));

    let written = 0;
    let writeError: string | undefined;

    // Chunked because one board can carry several hundred roles and a single
    // enormous statement is the thing most likely to time out.
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await db.from("jobs").upsert(chunk, { onConflict: "provider,external_id" });
      if (error) {
        writeError = error.message;
        break;
      }
      written += chunk.length;
    }

    // Anything from this board we did not see this time has been taken down.
    // Marked closed rather than deleted: someone may have applied to it, and
    // a dead link is a better answer than a missing page.
    let retired = 0;
    if (!writeError) {
      const { data: closed } = await db
        .from("jobs")
        .update({ is_active: false, closed_at: new Date().toISOString() })
        .eq("source_id", source.id)
        .eq("is_active", true)
        .lt("last_seen_at", startedAt)
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

  return Response.json({
    ok: report.every((r) => r.ok),
    sources: report.length,
    written: report.reduce((n, r) => n + (r.written ?? 0), 0),
    retired: report.reduce((n, r) => n + (r.retired ?? 0), 0),
    report,
  });
}

/**
 * Two ways in, both secrets.
 *
 * Vercel Cron sends a bearer token it holds itself, which is the path used in
 * production. The header is there so a run can be triggered by hand without
 * handing anybody the cron secret.
 */
function authorise(request: Request): Response | null {
  const cron = process.env.CRON_SECRET;
  const manual = process.env.INGEST_SECRET;

  const auth = request.headers.get("authorization");
  if (cron && auth === `Bearer ${cron}`) return null;

  const header = request.headers.get("x-ingest-secret");
  if (manual && header && timingSafeEqual(header, manual)) return null;

  return Response.json({ ok: false, error: "Not authorised" }, { status: 401 });
}

/** Constant time, so the response time cannot be used to guess the secret. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
