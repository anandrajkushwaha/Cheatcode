import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/seo/constants";
import { getClosingSoon, getNoticesResult } from "@/lib/govt/query";
import { KIND_LABEL, NOTICE_KINDS } from "@/lib/govt/types";
import { Deadline, NoticeColumn, StatusPill } from "@/components/govt/bits";

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
 * than to a PDF, so arriving from "SSC CGL result" lands somewhere that also
 * says when the exam is and whether the answer key is out.
 */
export const metadata: Metadata = {
  title: "Government Jobs 2026 — Sarkari Naukri, Results, Admit Cards | Cheatcode",
  description:
    "Latest government job notifications, results, admit cards, answer keys and syllabus, taken from the official recruitment boards and linked back to them. Free, no sign-up.",
  alternates: { canonical: `${SITE.url}/government-jobs` },
  openGraph: {
    title: "Government Jobs — Cheatcode",
    description:
      "Latest sarkari job notifications, results and admit cards, from the official boards.",
    url: `${SITE.url}/government-jobs`,
    siteName: SITE.name,
    type: "website",
  },
};

export default async function GovernmentJobsHub() {
  const [results, closing] = await Promise.all([
    Promise.all(
      NOTICE_KINDS.map(async (k) => ({ kind: k, ...(await getNoticesResult(k, 10)) })),
    ),
    getClosingSoon(6),
  ]);

  const columns = results.map(({ kind, notices }) => ({ kind, notices }));
  const empty = columns.every((c) => c.notices.length === 0);
  // One reason for all six, because all six read the same table.
  const problem = results.find((r) => r.error);

  return (
    <div className="container-page pb-20 pt-8 sm:pb-28 sm:pt-10">
      <header className="max-w-[60ch]">
        <h1 className="text-[1.7rem] font-semibold tracking-[-0.035em] sm:text-[2.1rem]">
          Government jobs
        </h1>
        <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink-50">
          Notifications, results, admit cards and answer keys — taken from the recruitment boards
          themselves, and linked back to them. Nothing here asks you to sign up.
        </p>
      </header>

      {empty ? (
        /* A first-run state rather than six empty boxes. Six boxes each saying
           "nothing yet" reads as broken; one sentence reads as early. */
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
              <h2 className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
                Closing soon
              </h2>
              <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {closing.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/government-jobs/${e.slug}`}
                      className="flex h-full flex-col gap-2 rounded-2xl border border-ink-08 bg-paper p-4 transition-colors hover:border-ink-30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[0.76rem] font-medium uppercase tracking-[0.1em] text-ink-30">
                          {e.organisation}
                        </span>
                        <StatusPill exam={e} />
                      </div>
                      <span className="text-[0.95rem] font-medium leading-snug">{e.name}</span>
                      {e.shown.has("application_end") && <Deadline end={e.applicationEnd} />}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-10 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {columns.map(({ kind, notices }) => (
              <NoticeColumn key={kind} kind={kind} title={KIND_LABEL[kind]} notices={notices} />
            ))}
          </div>
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
