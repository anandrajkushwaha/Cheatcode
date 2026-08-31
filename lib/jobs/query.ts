import "server-only";
import { createAppServerClient } from "@/lib/supabase/app";

export type JobRow = {
  id: string;
  title: string;
  company: string;
  department: string | null;
  location_raw: string | null;
  cities: string[];
  is_remote: boolean;
  employment_type: string | null;
  seniority: string | null;
  years_min: number | null;
  years_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[];
  apply_url: string;
  posted_at: string | null;
  total_count: number;
};

export type JobSearch = {
  q?: string;
  cities?: string[];
  remote?: boolean;
  maxYears?: number | null;
  page?: number;
  /** Home shows a handful; the browse page shows a page. */
  limit?: number;
};

export const PER_PAGE = 20;

/**
 * One call into one SQL function.
 *
 * The filtering and the total count come back from the same query, which is
 * the only way a pagination bar can be trusted — build them separately and
 * they drift the moment a filter changes, and the symptom is a page 4 that
 * renders empty.
 */
export async function searchJobs(
  search: JobSearch,
): Promise<{ jobs: JobRow[]; total: number; error?: string }> {
  const supabase = await createAppServerClient();
  if (!supabase) return { jobs: [], total: 0, error: "Accounts aren't configured." };

  const page = Math.max(1, Math.floor(search.page ?? 1));

  const { data, error } = await supabase.rpc("search_jobs", {
    p_query: search.q?.trim() || null,
    p_cities: search.cities?.length ? search.cities : null,
    p_remote: search.remote ?? null,
    p_max_years: search.maxYears ?? null,
    p_limit: search.limit ?? PER_PAGE,
    p_offset: (page - 1) * (search.limit ?? PER_PAGE),
  });

  if (error) {
    // The function only exists after 30_jobs.sql has been run. Saying so
    // beats an empty page that looks like "there are no jobs".
    const missing = /function .*search_jobs.* does not exist/i.test(error.message);
    return {
      jobs: [],
      total: 0,
      error: missing
        ? "Jobs aren't set up in this database yet — run supabase/schemas/30_jobs.sql."
        : error.message,
    };
  }

  const rows = (data ?? []) as JobRow[];
  return { jobs: rows, total: Number(rows[0]?.total_count ?? 0) };
}

/** How many jobs exist at all — for the empty state, which needs to know why. */
export async function countJobs(): Promise<number> {
  const supabase = await createAppServerClient();
  if (!supabase) return 0;
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  return count ?? 0;
}
