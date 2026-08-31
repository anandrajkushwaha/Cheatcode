import Link from "next/link";
import { getProfile } from "@/lib/app/account";
import { searchJobs, countJobs, PER_PAGE } from "@/lib/jobs/query";
import { CANONICAL_CITIES } from "@/lib/geo/cities";
import { JobFilters } from "@/components/app/JobFilters";
import { JobCard } from "@/components/app/JobCard";

export const dynamic = "force-dynamic";

/**
 * Browse.
 *
 * Free, and staying free. Matching — the ranked, explained shortlist — is
 * what the plan is for; a searchable list of public postings is not something
 * to charge for, and putting it behind the paywall would mean nobody ever
 * sees whether the jobs are any good before deciding to pay.
 *
 * On the first visit the filters are pre-filled from the profile: their
 * cities, their experience. That is not matching, and the page says so —
 * it is the same list, opened at the part that concerns them.
 */
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const profile = await getProfile();

  const one = (key: string): string | undefined => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  // "touched" means the person has interacted with the filters at all. Until
  // then their profile supplies the defaults; afterwards, an empty filter is
  // an empty filter and must not be quietly refilled.
  const touched = ["q", "cities", "remote", "exp", "page"].some((k) => one(k) !== undefined);

  const citiesParam = one("cities");
  const cities = touched
    ? (citiesParam ?? "")
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

  const q = touched ? (one("q") ?? "") : "";
  const remote = touched ? one("remote") === "1" : Boolean(profile?.open_to_remote && !cities.length);
  const page = Math.max(1, Number(one("page") ?? 1) || 1);

  const [{ jobs, total, error }, totalInDb] = await Promise.all([
    searchJobs({ q, cities, remote, maxYears, page }),
    countJobs(),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const filtered = Boolean(q || cities.length || remote || maxYears !== null);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Jobs</h1>
          <p className="mt-2 max-w-[62ch] text-[0.92rem] leading-relaxed text-ink-50">
            Pulled every morning from company job boards — Greenhouse, Lever and Ashby. India only,
            and every link goes straight to the company.
          </p>
        </div>
        {totalInDb > 0 && (
          <p className="text-[0.8rem] text-ink-30">{totalInDb.toLocaleString("en-IN")} open roles</p>
        )}
      </div>

      {!touched && filtered && (
        <p className="mt-5 rounded-xl border border-ink-08 bg-ink-04/50 px-4 py-3 text-[0.83rem] leading-relaxed text-ink-50">
          Filtered by what your profile says — {describe(cities, maxYears, remote)}. Change anything
          below and it stays changed.
        </p>
      )}

      <div className="mt-6">
        <JobFilters defaults={{ q, cities, remote, maxYears }} />
      </div>

      {error ? (
        <div className="mt-8 rounded-2xl border border-ink-30 p-6">
          <p className="text-[0.9rem] font-medium">Jobs could not be loaded</p>
          <p className="mt-2 max-w-[64ch] text-[0.85rem] leading-relaxed text-ink-50">{error}</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-15 p-8 text-center">
          <p className="text-[0.95rem] font-medium">
            {totalInDb === 0 ? "No jobs have been pulled in yet" : "Nothing matches those filters"}
          </p>
          <p className="mx-auto mt-2.5 max-w-[52ch] text-[0.86rem] leading-relaxed text-ink-50">
            {totalInDb === 0
              ? "The first sync has not run yet. Trigger /api/jobs/ingest, or wait for the morning run."
              : "Try removing a city, or widening the experience filter."}
          </p>
          {totalInDb > 0 && (
            <Link
              href="/app/jobs"
              className="mt-5 inline-block rounded-full border border-ink-15 px-5 py-2.5 text-[0.85rem] transition-colors hover:border-ink-30"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="mt-7 text-[0.82rem] text-ink-30">
            {total.toLocaleString("en-IN")} {total === 1 ? "job" : "jobs"}
            {lastPage > 1 ? ` · page ${page} of ${lastPage}` : ""}
          </p>

          <div className="mt-3 grid gap-3">
            {jobs.map((job, i) => (
              <JobCard key={job.id} job={job} delay={Math.min(i, 8) * 45} />
            ))}
          </div>

          {lastPage > 1 && (
            <nav className="mt-8 flex items-center justify-between gap-4">
              <PageLink params={params} page={page - 1} disabled={page <= 1}>
                Previous
              </PageLink>
              <span className="text-[0.8rem] text-ink-30">
                {page} / {lastPage}
              </span>
              <PageLink params={params} page={page + 1} disabled={page >= lastPage}>
                Next
              </PageLink>
            </nav>
          )}
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ bits */

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: Record<string, string | string[] | undefined>;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-full border border-ink-08 px-5 py-2 text-[0.84rem] text-ink-30">
        {children}
      </span>
    );
  }
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page") continue;
    const value = Array.isArray(v) ? v[0] : v;
    if (value) next.set(k, value);
  }
  next.set("page", String(page));
  return (
    <Link
      href={`/app/jobs?${next.toString()}`}
      className="rounded-full border border-ink-15 px-5 py-2 text-[0.84rem] transition-colors hover:border-ink-30"
    >
      {children}
    </Link>
  );
}

function clampYears(n: number): number | null {
  if (!Number.isFinite(n) || n < 0 || n > 50) return null;
  return Math.round(n * 10) / 10;
}

function describe(cities: string[], years: number | null, remote: boolean): string {
  const parts: string[] = [];
  if (cities.length) parts.push(cities.slice(0, 3).join(", "));
  if (remote && !cities.length) parts.push("remote");
  if (years !== null) parts.push(years === 0 ? "fresher" : `${years} years' experience`);
  return parts.join(" · ") || "your preferences";
}
