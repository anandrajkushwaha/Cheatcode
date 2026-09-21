import Link from "next/link";
import { getProfile } from "@/lib/app/account";
import { searchJobs, countJobs, PER_PAGE, type JobSort } from "@/lib/jobs/query";
import { CANONICAL_CITIES } from "@/lib/geo/cities";
import { JobFilterRail, JobSearchBar, type Filters } from "@/components/studio/JobFilterRail";
import { JobListCard } from "@/components/studio/JobListCard";

export const dynamic = "force-dynamic";

/**
 * Jobs.
 *
 * Free, and staying free. Matching — the ranked, explained shortlist — is
 * what the plan is for; a searchable list of public postings is not something
 * to charge for, and hiding it would mean nobody sees whether the jobs are
 * any good before deciding whether to pay.
 *
 * On a first visit the filters come from the profile: their cities, their
 * experience. That is not matching and the page says so — it is the same
 * list, opened at the part that concerns them. The moment they touch a
 * filter, `t=1` goes into the URL and the profile stops supplying anything.
 * Without that flag, clearing a city would silently refill it from the
 * profile and the filter would look broken.
 */

const SORTS = new Set<JobSort>(["recent", "salary", "relevance"]);

export default async function StudioJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, profile] = await Promise.all([searchParams, getProfile()]);

  const one = (key: string): string | undefined => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const touched = one("t") === "1";

  const cities = touched
    ? (one("cities") ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter((c) => (CANONICAL_CITIES as readonly string[]).includes(c))
    : (profile?.preferred_cities ?? []).filter((c) =>
        (CANONICAL_CITIES as readonly string[]).includes(c),
      );

  const expParam = one("exp");
  const maxYears = touched
    ? expParam !== undefined && expParam !== ""
      ? clampYears(Number(expParam))
      : null
    : (profile?.years_experience ?? null);

  const q = one("q")?.trim() ?? "";
  const remote = touched
    ? one("remote") === "1"
    : Boolean(profile?.open_to_remote && !cities.length);

  const ageParam = Number(one("age"));
  const maxAgeDays = Number.isFinite(ageParam) && ageParam > 0 ? Math.min(365, ageParam) : null;

  const sortParam = one("sort") as JobSort | undefined;
  // A search with no explicit sort is ordered by relevance; without a query
  // "best match" has nothing to match against, so it falls back to newest.
  const sort: JobSort =
    sortParam && SORTS.has(sortParam) ? sortParam : q ? "relevance" : "recent";

  const page = Math.max(1, Number(one("page") ?? 1) || 1);

  const [{ jobs, total, error }, totalInDb] = await Promise.all([
    searchJobs({ q, cities, remote, maxYears, maxAgeDays, sort, page }),
    countJobs(),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const filtered = Boolean(q || cities.length || remote || maxYears !== null || maxAgeDays);

  const filters: Filters = { q, cities, remote, maxYears, maxAgeDays };

  // Preserves every other filter while only the page number moves.
  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (cities.length) next.set("cities", cities.join(","));
    if (remote) next.set("remote", "1");
    if (maxYears !== null) next.set("exp", String(maxYears));
    if (maxAgeDays) next.set("age", String(maxAgeDays));
    if (sortParam && SORTS.has(sortParam)) next.set("sort", sortParam);
    next.set("t", "1");
    if (n > 1) next.set("page", String(n));
    return `/app/jobs?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Jobs</h1>
        {totalInDb > 0 && (
          <p className="text-[0.8rem] text-ink-30">
            {totalInDb.toLocaleString("en-IN")} open roles
          </p>
        )}
      </div>

      <JobSearchBar q={q} sort={sort} base={pageHref(1).split("?")[1] ?? ""} />

      {!touched && filtered && (
        <p className="rounded-xl border border-ink-08 bg-paper px-4 py-3 text-[0.82rem] leading-relaxed text-ink-50">
          Opened at what your profile says — {describe(cities, maxYears, remote)}. Change
          anything and it stays changed.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[264px_minmax(0,1fr)]">
        <JobFilterRail filters={filters} base={pageHref(1).split("?")[1] ?? ""} />

        <div className="min-w-0">
          {error ? (
            <div className="rounded-2xl border border-ink-30 bg-paper p-6">
              <p className="text-[0.9rem] font-medium">Jobs could not be loaded</p>
              <p className="mt-2 max-w-[64ch] text-[0.85rem] leading-relaxed text-ink-50">
                {error}
              </p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-15 bg-paper p-8 text-center">
              <p className="text-[0.95rem] font-medium">
                {totalInDb === 0
                  ? "No jobs have been pulled in yet"
                  : "Nothing matches those filters"}
              </p>
              <p className="mx-auto mt-2.5 max-w-[52ch] text-[0.85rem] leading-relaxed text-ink-50">
                {totalInDb === 0
                  ? "New roles are pulled in every morning. Check back tomorrow."
                  : "Try removing a city, widening the experience filter, or looking further back than the last few days."}
              </p>
              {totalInDb > 0 && (
                <Link
                  href="/app/jobs?t=1"
                  className="mt-5 inline-block rounded-full border border-ink-15 bg-paper px-5 py-2.5 text-[0.85rem] transition-colors hover:border-ink-30"
                >
                  Clear filters
                </Link>
              )}
            </div>
          ) : (
            <>
              <p className="pb-3 text-[0.8rem] text-ink-30">
                {total.toLocaleString("en-IN")} {total === 1 ? "role" : "roles"}
                {filtered ? " match" : ""}
                {lastPage > 1 ? ` · page ${page} of ${lastPage}` : ""}
              </p>

              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobListCard key={job.id} job={job} />
                ))}
              </div>

              {lastPage > 1 && (
                <nav
                  aria-label="Pagination"
                  className="mt-6 flex items-center justify-between gap-4"
                >
                  {page > 1 ? (
                    <Link
                      href={pageHref(page - 1)}
                      className="rounded-full border border-ink-15 bg-paper px-4 py-2 text-[0.82rem] transition-colors hover:border-ink-30"
                    >
                      ← Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="text-[0.8rem] tabular-nums text-ink-30">
                    {page} / {lastPage}
                  </span>
                  {page < lastPage ? (
                    <Link
                      href={pageHref(page + 1)}
                      className="rounded-full border border-ink-15 bg-paper px-4 py-2 text-[0.82rem] transition-colors hover:border-ink-30"
                    >
                      Next →
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function clampYears(n: number): number | null {
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(30, Math.round(n));
}

function describe(cities: string[], maxYears: number | null, remote: boolean): string {
  const parts: string[] = [];
  if (cities.length) parts.push(cities.join(", "));
  if (remote) parts.push("remote roles");
  if (maxYears !== null) {
    parts.push(maxYears === 0 ? "fresher roles" : `up to ${maxYears} years' experience`);
  }
  return parts.join(", ") || "everything";
}
