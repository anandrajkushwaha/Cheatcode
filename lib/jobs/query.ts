import "server-only";
import { createAppAdminClient, createAppServerClient } from "@/lib/supabase/app";

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

/** What the list can be ordered by. Unknown values fall back to "recent". */
export type JobSort = "recent" | "salary" | "relevance";

export type JobSearch = {
  q?: string;
  cities?: string[];
  remote?: boolean;
  maxYears?: number | null;
  page?: number;
  /** Home shows a handful; the browse page shows a page. */
  limit?: number;
  /** Null means any age; otherwise a cut-off in days against posted_at. */
  maxAgeDays?: number | null;
  sort?: JobSort;
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
  return run(call(supabase), search);
}

/**
 * The same search, for the page outside the sign-in wall.
 *
 * `jobs` is granted to `authenticated` and `search_jobs` is executable by
 * `authenticated` — so the ordinary client returns nothing at all to a
 * signed-out visitor, silently and with no error. Rather than opening the
 * table and the function to `anon` (two more grants, in a migration that has
 * to be run before the page can ship), the public page reads with the service
 * key, the way the government-jobs pages do.
 *
 * Safe because the function itself only ever returns active postings, and
 * this wrapper takes no caller-supplied SQL — the same arguments the signed-in
 * page sends, from a URL.
 */
export async function searchJobsPublic(
  search: JobSearch,
): Promise<{ jobs: JobRow[]; total: number; error?: string }> {
  const supabase = createAppAdminClient();
  if (!supabase) return { jobs: [], total: 0, error: "Accounts aren't configured." };
  return run(call(supabase), search);
}

/**
 * The call, adapted.
 *
 * `run` is handed a function rather than a client on purpose: the two clients
 * carry different generics, and a structural type wide enough for both sends
 * the compiler into "type instantiation is excessively deep". One narrow
 * adapter at each call site is cheaper than that, and it keeps the arguments
 * and the error handling in one place where they can only be written once.
 */
type Rpc = (args: Record<string, unknown>) => Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

const call = (supabase: { rpc: (fn: string, args: Record<string, unknown>) => unknown }): Rpc =>
  (args) =>
    supabase.rpc("search_jobs", args) as Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;

async function run(
  rpc: Rpc,
  search: JobSearch,
): Promise<{ jobs: JobRow[]; total: number; error?: string }> {

  const page = Math.max(1, Math.floor(search.page ?? 1));

  /**
   * The two newer arguments are only sent when they are actually being used.
   *
   * This is a deployment-order safeguard, not tidiness. `search_jobs` grew
   * from six parameters to eight in 33_jobs_browse.sql, and PostgREST matches
   * a function by the argument names it is given — so an eight-argument call
   * against a database that still has the six-argument version fails with
   * "could not find the function".
   *
   * Sending six when six will do means /app's jobs page, and the home
   * screen's buckets, keep working on either version of the database. Only
   * the studio's browse page — the one that offers sorting and a freshness
   * filter — needs the migration to have been run, and it is the only caller
   * that asks for them.
   */
  const args: Record<string, unknown> = {
    p_query: search.q?.trim() || null,
    p_cities: search.cities?.length ? search.cities : null,
    p_remote: search.remote ?? null,
    p_max_years: search.maxYears ?? null,
    p_limit: search.limit ?? PER_PAGE,
    p_offset: (page - 1) * (search.limit ?? PER_PAGE),
  };
  if (search.maxAgeDays != null) args.p_max_age_days = search.maxAgeDays;
  if (search.sort && search.sort !== "recent") args.p_sort = search.sort;

  const { data, error } = await rpc(args);

  if (error) {
    // The function only exists after 30_jobs.sql has been run. Saying so
    // beats an empty page that looks like "there are no jobs".
    // Either the function was never created, or it is still the six-argument
    // version from before 33_jobs_browse.sql — PostgREST reports both as the
    // function not existing, and the fix is the same either way: run the SQL.
    const missing =
      /function .*search_jobs.* does not exist/i.test(error.message) ||
      /could not find the function/i.test(error.message);
    return {
      jobs: [],
      total: 0,
      error: missing
        ? "Jobs aren't set up in this database yet — run supabase/schemas/30_jobs.sql, then 33_jobs_browse.sql."
        : error.message,
    };
  }

  // Checked rather than cast. `data ?? []` covers null and nothing else, so a
  // non-array reply — which PostgREST sends if the function's return type ever
  // changes — sailed straight through the `as JobRow[]` and only failed later,
  // inside whichever caller reached for .find or .map first. This is the one
  // place that knows the answer is supposed to be a list, so it is enforced
  // here rather than defended against in five callers.
  const rows: JobRow[] = Array.isArray(data) ? (data as JobRow[]) : [];
  return { jobs: rows, total: Number(rows[0]?.total_count ?? 0) };
}

/** How many jobs exist at all — for the empty state, which needs to know why. */
export async function countJobs(): Promise<number> {
  const supabase = await createAppServerClient();
  if (!supabase) return 0;
  return count(supabase.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true));
}

/** The same count, read with the service key. See searchJobsPublic. */
export async function countJobsPublic(): Promise<number> {
  const supabase = createAppAdminClient();
  if (!supabase) return 0;
  return count(supabase.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true));
}

/**
 * Awaits a built count query.
 *
 * It takes the query rather than the client for the same reason `run` takes a
 * function: each client builds it with its own generics, and a parameter type
 * wide enough to accept both of them is what sends the compiler into "type
 * instantiation is excessively deep".
 */
async function count(query: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count: n } = await query;
  return n ?? 0;
}

