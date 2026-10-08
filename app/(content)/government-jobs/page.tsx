import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/seo/constants";
import { getClosingSoon, getClosed, getNoticesResult, getUndated } from "@/lib/govt/query";
import { KIND_LABEL, NOTICE_KINDS } from "@/lib/govt/types";
import { CLOSING_SOON_DAYS } from "@/lib/govt/lifecycle";
import { ExamCard, NoticeColumn } from "@/components/govt/bits";

export const revalidate = 120;

/**
 * The front door, and deliberately the shape people already know.
 *
 * Six parallel columns of dated links is what Sarkari Result looks like, and
 * recognising a layout is most of why somebody trusts a page like this in the
 * first three seconds. Copying the shape is not a failure of nerve — it is
 * the part of those sites that works.
 *
 * What is different sits underneath: every row links to an exam page rather
 * than to a PDF, and nothing claims a date, a status or a vacancy count that
 * nobody could point at a sentence for.
 */
export const metadata: Metadata = {
  title: "Government Jobs 2026 — Sarkari Naukri, Results, Admit Cards | Cheatcode",
  description:
    "Government job notifications, results, admit cards, answer keys and syllabus, taken from the official recruitment boards and linked back to them. Free, no sign-up.",
  alternates: { canonical: `${SITE.url}/government-jobs` },
  openGraph: {
    title: "Government Jobs — Cheatcode",
    description:
      "Sarkari job notifications, results and admit cards, from the official boards.",
    url: `${SITE.url}/government-jobs`,
    siteName: SITE.name,
    type: "website",
  },
};

export default async function GovernmentJobsHub() {
  const [results, closing, undated, closed] = await Promise.all([
    Promise.all(
      NOTICE_KINDS.map(async (k) => ({ kind: k, ...(await getNoticesResult(k, 10)) })),
    ),
    getClosingSoon(6),
    getUndated(1),
    getClosed(1),
  ]);

  // Ten per card, and the total so each card can say how many more there are.
  const columns = results.map(({ kind, notices, total }) => ({ kind, notices, total }));
  const empty = columns.every((c) => c.notices.length === 0);
  const problem = results.find((r) => r.error);

  return (
    /* Room at the foot for the floating assistant, which otherwise sits on top
       of the last row of the last column with nothing to scroll past it. */
    <div className="container-page pb-32 pt-8 sm:pb-28 sm:pt-10">
      <header className="max-w-[60ch]">
        <h1 className="text-[1.7rem] font-semibold tracking-[-0.035em] sm:text-[2.1rem]">
          Government jobs
        </h1>
        <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink-50">
          Notifications, results, admit cards and answer keys — taken from the recruitment boards
          themselves, and linked back to them. Nothing here asks you to sign up.
        </p>
        <p className="mt-2 text-[0.86rem] text-ink-30">
          After private-sector openings instead?{" "}
          <Link href="/jobs" className="underline underline-offset-4 hover:text-ink">
            Private jobs are here
          </Link>
          .
        </p>
      </header>

      {empty ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-15 p-8 text-center">
          <p className="text-[0.95rem] font-medium">
            {problem ? "Not available right now" : "Nothing published yet"}
          </p>
          <p className="mx-auto mt-2 max-w-[48ch] text-[0.88rem] leading-relaxed text-ink-50">
            {problem
              ? "We could not load notices just now. Please try again shortly."
              : "We are adding the first recruitment boards now. Notifications will appear here as they are published."}
          </p>
        </div>
      ) : (
        <>
          {closing.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-1 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
                Closing soon
              </h2>
              <p className="mb-3 text-[0.82rem] text-ink-30">
                Applications closing in the next {CLOSING_SOON_DAYS} days, nearest first.
              </p>
              <ul className="grid items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {closing.map((e) => (
                  <li key={e.id}>
                    <ExamCard exam={e} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* `items-start` is the whole fix for the three tall blank panels:
              a grid cell stretches to the tallest row unless told not to. */}
          <div className="mt-10 grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {columns.map(({ kind, notices, total }) => (
              <NoticeColumn
                key={kind}
                kind={kind}
                title={KIND_LABEL[kind]}
                notices={notices}
                total={total}
              />
            ))}
          </div>

          {(undated.length > 0 || closed.length > 0) && (
            <nav className="mt-8 flex flex-wrap gap-2">
              {undated.length > 0 && (
                <Link
                  href="/government-jobs/dates-not-stated"
                  className="rounded-full border border-ink-15 px-3.5 py-1.5 text-[0.82rem] text-ink-50 transition-colors hover:border-ink hover:text-ink"
                >
                  Recruitments with no stated closing date
                </Link>
              )}
              {closed.length > 0 && (
                <Link
                  href="/government-jobs/closed"
                  className="rounded-full border border-ink-15 px-3.5 py-1.5 text-[0.82rem] text-ink-50 transition-colors hover:border-ink hover:text-ink"
                >
                  Closed recruitments
                </Link>
              )}
            </nav>
          )}
        </>
      )}

      <p className="mt-10 max-w-[70ch] text-[0.8rem] leading-relaxed text-ink-30">
        Cheatcode is not a government body and does not accept applications. Every notice here links
        to the official notification on the recruiting authority&apos;s own website, and that page is
        the one to rely on.
      </p>
    </div>
  );
}
