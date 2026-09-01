import { createAppAdminClient } from "@/lib/supabase/app";
import { JobBoards, type Source } from "@/components/admin/JobBoards";

export const dynamic = "force-dynamic";

/**
 * Job boards.
 *
 * Read with the secret key rather than through RLS, because job_sources is
 * deliberately invisible to ordinary users — which boards we pull from is an
 * operational detail, not product data.
 */
export default async function AdminJobsPage() {
  const db = createAppAdminClient();

  if (!db) {
    return (
      <>
        <Head />
        <Notice
          title="Supabase isn't configured"
          body="Set APP_SUPABASE_SECRET_KEY (or SUPABASE_SECRET_KEY) and redeploy."
        />
      </>
    );
  }

  const [{ data: sources, error }, { count: totalJobs }] = await Promise.all([
    db.from("job_sources").select("*").order("company_name"),
    db.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  if (error) {
    const missing = /relation .*job_sources.* does not exist/i.test(error.message);
    return (
      <>
        <Head />
        <Notice
          title={missing ? "Jobs aren't set up in this database yet" : "Could not read the boards"}
          body={
            missing
              ? "Run supabase/schemas/30_jobs.sql in the SQL editor, then reload this page."
              : error.message
          }
        />
      </>
    );
  }

  // One count per board, in one query rather than N.
  const { data: perSource } = await db
    .from("jobs")
    .select("source_id")
    .eq("is_active", true)
    .limit(10_000);

  const counts = new Map<string, number>();
  for (const row of (perSource ?? []) as { source_id: string | null }[]) {
    if (row.source_id) counts.set(row.source_id, (counts.get(row.source_id) ?? 0) + 1);
  }

  const rows: Source[] = ((sources ?? []) as Record<string, unknown>[]).map((s) => ({
    id: String(s.id),
    provider: String(s.provider),
    token: String(s.token),
    company_name: String(s.company_name),
    careers_url: (s.careers_url as string) ?? null,
    is_active: Boolean(s.is_active),
    last_run_at: (s.last_run_at as string) ?? null,
    last_status: (s.last_status as string) ?? null,
    last_count: Number(s.last_count ?? 0),
    last_error: (s.last_error as string) ?? null,
    search_query: (s.search_query as string) ?? null,
    search_country: (s.search_country as string) ?? null,
    job_count: counts.get(String(s.id)) ?? 0,
  }));

  return (
    <>
      <Head />
      <div className="mt-7">
        <JobBoards sources={rows} totalJobs={totalJobs ?? 0} />
      </div>
    </>
  );
}

function Head() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Job boards</h1>
      <p className="mt-2.5 max-w-[70ch] text-[0.92rem] leading-relaxed text-ink-50">
        Where the jobs come from. Company boards — Greenhouse, Lever, Ashby — are published by
        those companies for syndication, are free, and give a direct apply link. Saved searches go
        through JSearch to Google for Jobs, which reaches Naukri, LinkedIn and Indeed; those cost a
        request each, so a few run per night in rotation. The cron runs each morning; this page is
        for when you do not want to wait.
      </p>
    </>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-7 rounded-2xl border border-ink-30 p-6">
      <p className="text-[0.9rem] font-medium">{title}</p>
      <p className="mt-2 max-w-[64ch] text-[0.85rem] leading-relaxed text-ink-50">{body}</p>
    </div>
  );
}
