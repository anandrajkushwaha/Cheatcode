import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/content/bits";
import { getPublishedBanks } from "@/lib/interview/bank";

export const revalidate = 3600;

/**
 * Indexable only once there is something on it.
 *
 * While no bank is published this page is a heading and "check back
 * shortly" — a thin page Google would index and judge the site by. So it
 * says noindex until the first role page exists, and the sitemap leaves it
 * out on the same rule.
 */
export async function generateMetadata(): Promise<Metadata> {
  const banks = await getPublishedBanks();
  return buildMetadata({
    title: "Interview Questions and Answers by Role | Cheatcode",
    description:
      "Real interview questions asked for jobs in India, with answers written the way a strong candidate would say them out loud. Free, by role.",
    path: "/interview-questions",
    noindex: banks.length === 0,
  });
}

/**
 * The index of role pages.
 *
 * Only published banks appear, and the page says so honestly when there are
 * none rather than rendering an empty grid under a confident heading.
 */
export default async function QuestionBankIndex() {
  const banks = await getPublishedBanks();

  return (
    <>
      <Breadcrumbs items={[{ label: "Interview questions" }]} />

      <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
        Interview questions, by role
      </h1>
      <p className="mt-4 max-w-[62ch] text-[0.95rem] leading-relaxed text-ink-50">
        The questions that actually come up in interviews for jobs in India,
        with answers written the way a strong candidate would say them out
        loud — not definitions to memorise.
      </p>

      {banks.length === 0 ? (
        <p className="mt-10 text-[0.9rem] leading-relaxed text-ink-30">
          The first role pages are being written. Check back shortly.
        </p>
      ) : (
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {banks.map((b) => (
            <Link
              key={b.slug}
              href={`/interview-questions/${b.slug}`}
              className="group rounded-2xl border border-ink-08 p-5 transition-colors hover:border-ink-30"
            >
              <p className="text-[1rem] font-semibold tracking-[-0.02em] group-hover:underline">
                {b.role} interview questions
              </p>
              <p className="mt-1.5 text-[0.82rem] text-ink-30">
                {b.count} questions with answers
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-14 rounded-2xl border border-ink-08 p-6">
        <p className="text-[1rem] font-semibold tracking-[-0.02em]">
          Reading them is not the same as answering them
        </p>
        <p className="mt-2 max-w-[58ch] text-[0.88rem] leading-relaxed text-ink-50">
          Cheatcode runs a mock interview on the actual job you are applying
          to, then tells you what to change — quoting your own answers back to
          you.
        </p>
        <Link
          href="/signin?next=/app/interviews"
          className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-[0.88rem] font-medium text-paper transition-opacity hover:opacity-90"
        >
          Practise in a mock interview · Pro
        </Link>
      </div>
    </>
  );
}
