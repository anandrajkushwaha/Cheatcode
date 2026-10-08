import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/seo/constants";
import { searchJobsPublic, countJobsPublic, PER_PAGE, type JobSort } from "@/lib/jobs/query";
import { CANONICAL_CITIES } from "@/lib/geo/cities";
import { JobListCard } from "@/components/studio/JobListCard";

export const revalidate = 900;

/**
 * Private-sector jobs, outside the sign-in wall.
 *
 * These have been ingested daily from company boards for months and have only
 * ever been visible to people with an account — which is the wrong way round
 * for the one page on this site with thousands of real, dated, searchable
 * rows. Government jobs went public first and made the asymmetry obvious: a
 * visitor could browse every sarkari notification but not a single company
 * posting.
 *
 * Deliberately no detail page. The row links to the company's own application
 * page, as it does inside the app — we did not write the posting, and a copy
 * of it on our domain is one more thing to keep in sync and one more step
 * between somebody and the job.
 *
 * Filters live in the URL and nowhere else. The signed-in version seeds them
 * from the profile; this one cannot and should not, which also makes every
 * filtered view a shareable link.
 */
export const metadata: Metadata = {
  title: "Private Jobs in India — Latest Openings from Company Career Pages | Cheatcode",
  description:
    "Jobs taken straight from company career pages — Greenhouse, Lever and Ashby boards — updated daily. Search by city, experience and remote. Free, no sign-up.",
  alternates: { canonical: `${SITE.url}/jobs` },
  openGraph: {
    title: "Private jobs in India — Cheatcode",
    description:
      "Openings taken straight from company career pages, updated daily. Free, no sign-up.",
    url: `${SITE.url}/jobs`,
    siteName: SITE.name,
    type: "website",
  },
};

const SORTS = new Set<JobSort>(["recent", "salary", "relevance"]);
const CITIES = CANONICAL_CITIES.slice(0, 10);

export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string): string | undefined => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const q = (one("q") ?? "").trim();
  const city = one("city") ?? "";
  const remote = one("remote") === "1";
  const sortRaw = one("sort") as JobSort | undefined;
  const sort: JobSort = sortRaw && SORTS.has(sortRaw) ? sortRaw : "recent";
  const page = Math.max(1, Number.parseInt(one("page") ?? "1", 10) || 1);

  const [result, total] = await Promise.all([
    searchJobsPublic({
      q: q || undefined,
      cities: city ? [city] : undefined,
      remote: remote ? true : undefined,
      sort,
      page,
      limit: PER_PAGE,
    }),
    countJobsPublic(),
  ]);

  const { jobs, error } = result;
  const matched = result.total;
  const pages = Math.max(1, Math.ceil(matched / PER_PAGE));
  const filtered = Boolean(q || city || remote);

  /** Keeps every other filter when one changes. */
  const href = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, city, remote: remote ? "1" : "", sort, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "sort" && v === "recent")) sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/jobs?${s}` : "/jobs";
  };

  return (
    <div className="container-page pb-20 pt-8 sm:pb-28 sm:pt-10">
      <header className="max-w-[62ch]">
        <h1 className="text-[1.7rem] font-semibold tracking-[-0.035em] sm:text-[2.1rem]">
          Private jobs
        </h1>
        <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink-50">
          {total > 0
            ? `${total.toLocaleString("en-IN")} openings taken straight from company career pages, updated every day. Nothing here asks you to sign up.`
            : "Openings taken straight from company career pages, updated every day."}
        </p>
        <p className="mt-2 text-[0.86rem] text-ink-30">
          Looking for sarkari naukri?{" "}
          <Link href="/government-jobs" className="underline underline-offset-4 hover:text-ink">
            Government jobs are here
          </Link>
          .
        </p>
      </header>

      {/* ----------------------------------------------------------- search */}
      <form action="/jobs" className="mt-7 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Job title, company or skill"
          aria-label="Search jobs"
          className="min-w-0 flex-1 rounded-xl border border-ink-15 bg-paper px-4 py-2.5 text-[16px] outline-none transition-colors placeholder:text-ink-30 focus:border-ink-50 sm:text-[0.92rem]"
        />
        {city && <input type="hidden" name="city" value={city} />}
        {remote && <input type="hidden" name="remote" value="1" />}
        <button
          type="submit"
          className="rounded-xl bg-ink px-5 py-2.5 text-[0.88rem] font-medium text-paper transition-opacity hover:opacity-90"
        >
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={href({ city: "", remote: "" })}
          className={chip(!city && !remote)}
          aria-current={!city && !remote ? "true" : undefined}
        >
          All
        </Link>
        <Link href={href({ city: "", remote: remote ? "" : "1" })} className={chip(remote)}>
          Remote
        </Link>
        {CITIES.map((c) => (
          <Link
            key={c}
            href={href({ city: city === c ? "" : c, remote: "" })}
            className={chip(city === c)}
          >
            {c}
          </Link>
        ))}
      </div>

      {/* ------------------------------------------------------------ list */}
      {jobs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-15 p-8 text-center">
          <p className="text-[0.95rem] font-medium">
            {filtered ? "No jobs match that" : "No jobs just yet"}
          </p>
          <p className="mx-auto mt-2 max-w-[48ch] text-[0.88rem] leading-relaxed text-ink-50">
            {error
              ? error
              : filtered
                ? "Try a different city, or clear the filters and search again."
                : "The board refreshes every morning from company career pages."}
          </p>
          {filtered && (
            <Link
              href="/jobs"
              className="mt-4 inline-flex rounded-full border border-ink-15 px-4 py-2 text-[0.84rem] transition-colors hover:border-ink"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="mt-7 text-[0.8rem] text-ink-30">
            {matched.toLocaleString("en-IN")} job{matched === 1 ? "" : "s"}
            {page > 1 ? ` · page ${page} of ${pages}` : ""}
          </p>
          <ul className="mt-3 space-y-2.5">
            {jobs.map((job) => (
              <li key={job.id}>
                <JobListCard job={job} />
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav className="mt-8 flex items-center justify-between gap-3">
              {page > 1 ? (
                <Link href={href({ page: String(page - 1) })} className={pager}>
                  Previous
                </Link>
              ) : (
                <span />
              )}
              {page < pages && (
                <Link href={href({ page: String(page + 1) })} className={pager}>
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

const pager =
  "rounded-full border border-ink-15 px-4 py-2 text-[0.84rem] transition-colors hover:border-ink";

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-[0.82rem] transition-colors ${
    on ? "border-ink bg-ink text-paper" : "border-ink-15 text-ink-50 hover:border-ink hover:text-ink"
  }`;
