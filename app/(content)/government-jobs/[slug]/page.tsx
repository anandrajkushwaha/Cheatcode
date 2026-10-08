import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/lib/seo/constants";
import { getExam } from "@/lib/govt/query";
import { formatDate, verifiedDeadline, type ExamWithNotices } from "@/lib/govt/types";
import { lifecycleOf } from "@/lib/govt/lifecycle";
import { Deadline, StatusPill } from "@/components/govt/bits";
import { Lifecycle } from "@/components/govt/Lifecycle";

export const revalidate = 120;

/**
 * One recruitment, and everything published about it.
 *
 * The page this feature exists for. Everything else — the hub, the six kind
 * pages — is a way of arriving here.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exam = await getExam(slug);
  if (!exam) return { title: "Not found | Cheatcode", robots: { index: false, follow: false } };
  // A withdrawn listing answers, but must not stay in the index.
  if (exam.status === "retired") {
    return {
      title: "Listing withdrawn — Government jobs | Cheatcode",
      robots: { index: false, follow: true },
    };
  }

  // Written the way somebody types it into Google, and only with facts we
  // have: a title promising a vacancy count we do not hold is the kind of
  // thing that gets a page clicked once and never again.
  const bits = [exam.organisation, exam.name].filter(Boolean).join(" ");
  const facts: string[] = [];
  if (exam.shown.has("vacancies") && exam.vacancies) {
    facts.push(`${exam.vacancies.toLocaleString("en-IN")} Vacancies`);
  }
  if (exam.shown.has("application_end") && exam.applicationEnd) {
    facts.push(`Last Date ${formatDate(exam.applicationEnd)}`);
  }

  const title = `${bits} Notification${facts.length ? ` — ${facts.join(", ")}` : ""} | Cheatcode`;
  const description =
    `${bits}: notification, important dates, eligibility and the official apply link` +
    (exam.shown.has("application_end") && exam.applicationEnd
      ? `. Applications close ${formatDate(exam.applicationEnd)}.`
      : ". Dates as stated in the official notification.");

  return {
    title,
    description,
    alternates: { canonical: `${SITE.url}/government-jobs/${exam.slug}` },
    openGraph: {
      title: `${bits} — Cheatcode`,
      description,
      url: `${SITE.url}/government-jobs/${exam.slug}`,
      siteName: SITE.name,
      type: "article",
    },
  };
}

export default async function ExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exam = await getExam(slug);
  if (!exam) notFound();

  /**
   * A listing we took down.
   *
   * It answers rather than 404s, because the URL was published and indexed
   * and somebody has arrived on it. What it must not do is pretend to be a
   * recruitment: no apply button, no dates, no facts — just what happened and
   * the way back.
   */
  if (exam.status === "retired") {
    return (
      <div className="container-page pb-32 pt-10 sm:pb-28">
        <div className="mx-auto max-w-[56ch] rounded-2xl border border-ink-08 bg-paper p-7 text-center">
          <h1 className="text-[1.25rem] font-semibold tracking-[-0.02em]">
            This listing has been withdrawn
          </h1>
          <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-50">
            We published this entry automatically and could not verify that it described a
            specific recruitment, so we have taken it down rather than leave it up. Nothing has
            been removed from any official website.
          </p>
          <Link
            href="/government-jobs"
            className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-[0.86rem] font-medium text-paper transition-opacity hover:opacity-90"
          >
            Browse government jobs
          </Link>
        </div>
      </div>
    );
  }

  const lifecycle = lifecycleOf(verifiedDeadline(exam));
  const applyUrl =
    exam.applyUrl ?? exam.notices.find((n) => n.kind === "job")?.officialUrl ?? null;

  return (
    <div className="container-page pb-20 pt-6 sm:pb-28 sm:pt-8">
      <nav className="mb-5 text-[0.8rem] text-ink-30">
        <Link href="/government-jobs" className="transition-colors hover:text-ink">
          Government jobs
        </Link>
        <span className="px-1.5">/</span>
        <span>{exam.organisation}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0">
          <header>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[0.76rem] font-medium uppercase tracking-[0.12em] text-ink-30">
                {exam.organisation}
              </span>
              <StatusPill exam={exam} />
            </div>
            <h1 className="mt-2 text-[1.55rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[2rem]">
              {exam.name}
            </h1>
            {exam.shown.has("application_end") && (
              <p className="mt-2">
                <Deadline end={exam.applicationEnd} />
              </p>
            )}
          </header>

          <Facts exam={exam} />

          <div className="mt-10">
            <Lifecycle notices={exam.notices} />
          </div>

          {exam.selectionProcess.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
                Selection process
              </h2>
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
                {exam.selectionProcess.map((step, i) => (
                  <li key={step} className="flex items-center gap-2">
                    <span className="rounded-full border border-ink-15 px-3 py-1.5 text-[0.84rem]">
                      {step}
                    </span>
                    {i < exam.selectionProcess.length - 1 && (
                      <span aria-hidden="true" className="text-ink-30">
                        →
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {exam.about && (
            <section className="mt-10 max-w-[68ch]">
              <h2 className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
                About this recruitment
              </h2>
              <p className="whitespace-pre-line text-[0.92rem] leading-relaxed text-ink-70">
                {exam.about}
              </p>
            </section>
          )}

          {exam.notices.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
                Every notice from {exam.organisation} on this exam
              </h2>
              <ul className="rounded-2xl border border-ink-08 bg-paper px-4 sm:px-5">
                {exam.notices.map((n) => (
                  <li key={n.id} className="flex gap-3 border-b border-ink-08 py-3 last:border-0">
                    <a
                      href={n.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="min-w-0 flex-1 text-[0.9rem] leading-snug hover:underline"
                    >
                      {n.title}
                    </a>
                    <span className="shrink-0 whitespace-nowrap text-[0.74rem] text-ink-30">
                      {formatDate(n.publishedOn) ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>

        {/* ------------------------------------------------------------ apply */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <div className="rounded-2xl border border-ink-08 bg-paper p-5">
            {applyUrl ? (
              <>
                <a
                  href={applyUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className={`block rounded-full px-5 py-3 text-center text-[0.9rem] font-medium transition-opacity hover:opacity-90 ${
                    lifecycle === "closed"
                      ? "border border-ink-15 text-ink-50"
                      : "bg-ink text-paper"
                  }`}
                >
                  {lifecycle === "closed" ? "View the notification" : "Apply on the official website"}
                </a>
                <p className="mt-3 text-[0.76rem] leading-relaxed text-ink-30">
                  This opens the recruiting authority&apos;s own site. Cheatcode is not a government
                  body and takes no application or fee.
                </p>
              </>
            ) : (
              <p className="text-[0.86rem] leading-relaxed text-ink-50">
                No official link has been published for this recruitment yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * The facts, and only the ones we can stand behind.
 *
 * A field is drawn only when `shown` holds it — meaning the value came with
 * the sentence it was read from. Everything else is left out rather than
 * guessed, and the closing line tells the reader where to get what is
 * missing. A missing last date costs a click; a wrong one costs the job.
 */
function Facts({ exam }: { exam: ExamWithNotices }) {
  const rows: { label: string; value: string }[] = [];

  if (exam.shown.has("vacancies") && exam.vacancies) {
    rows.push({ label: "Vacancies", value: exam.vacancies.toLocaleString("en-IN") });
  }
  if (exam.qualificationText) {
    rows.push({ label: "Qualification", value: exam.qualificationText });
  }
  if (exam.shown.has("age_min") || exam.shown.has("age_max")) {
    const lo = exam.shown.has("age_min") ? exam.ageMin : null;
    const hi = exam.shown.has("age_max") ? exam.ageMax : null;
    if (lo || hi) {
      rows.push({
        label: "Age",
        value: `${lo ?? "—"} to ${hi ?? "—"} years as stated — relaxations apply, see the notification`,
      });
    }
  }
  if (exam.shown.has("application_start") && exam.applicationStart) {
    rows.push({ label: "Applications open", value: formatDate(exam.applicationStart) ?? "" });
  }
  if (exam.shown.has("application_end") && exam.applicationEnd) {
    rows.push({ label: "Last date", value: formatDate(exam.applicationEnd) ?? "" });
  }
  if (exam.shown.has("fee_by_category") && exam.feeByCategory) {
    rows.push({
      label: "Application fee",
      value: Object.entries(exam.feeByCategory)
        .map(([k, v]) => `${k.toUpperCase()} ₹${v}`)
        .join(" · "),
    });
  }
  if (exam.examDateFrom) {
    const to = exam.examDateTo && exam.examDateTo !== exam.examDateFrom;
    rows.push({
      label: "Exam date",
      value:
        `${formatDate(exam.examDateFrom)}${to ? ` to ${formatDate(exam.examDateTo)}` : ""}` +
        (exam.dateNote ? ` — ${exam.dateNote}` : ""),
    });
  }
  rows.push({
    label: "Where",
    value: exam.isAllIndia ? "All India" : exam.states.join(", ") || "See the notification",
  });

  return (
    <section className="mt-7">
      <dl className="grid gap-x-8 gap-y-3.5 rounded-2xl border border-ink-08 bg-paper p-5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-[0.72rem] font-medium uppercase tracking-[0.12em] text-ink-30">
              {r.label}
            </dt>
            <dd className="mt-1 text-[0.9rem] leading-snug">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-[0.78rem] leading-relaxed text-ink-30">
        Anything not listed here was not stated plainly enough in the notification for us to repeat
        it. The official notification is linked above and is the one to go by.
      </p>
    </section>
  );
}
