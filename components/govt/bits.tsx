import Link from "next/link";
import { KIND_SLUG, formatDate, verifiedDeadline, type Notice } from "@/lib/govt/types";
import { LIFECYCLE_LABEL, daysLeft, lifecycleOf, type Lifecycle } from "@/lib/govt/lifecycle";

/**
 * The small pieces every government-jobs screen is built from.
 *
 * All server components: none of them holds state, and keeping them off the
 * client means a list of forty notices ships no JavaScript at all.
 */

const PILL: Record<Lifecycle, string> = {
  open: "border-[#1a7f37]/30 bg-[#f2fbf4] text-[#1a7f37]",
  closing_soon: "border-[#fdaa29]/50 bg-[#fffaf0] text-[#8a5a12]",
  closed: "border-ink-15 bg-ink-04 text-ink-50",
  unknown: "border-ink-15 bg-paper text-ink-30",
};

/**
 * The deadline state, and only ever the deadline state.
 *
 * It reads the date through `verifiedDeadline`, so a value nobody could point
 * at a sentence for shows as "Dates not stated" rather than quietly becoming
 * "Open". The distinction matters more here than anywhere: "Open" on a
 * government-jobs page is read as "you can still apply", and the one thing
 * worse than no deadline is a deadline we made up.
 */
export function StatusPill({
  exam,
}: {
  exam: { applicationEnd: string | null; shown: Set<string> };
}) {
  const s = lifecycleOf(verifiedDeadline(exam));
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[0.72rem] font-medium ${PILL[s]}`}
    >
      {LIFECYCLE_LABEL[s]}
    </span>
  );
}

/**
 * How long is left.
 *
 * Rendered from the date rather than baked in as a sentence, because these
 * pages are cached for ten minutes and a page that says "3 days left" has to
 * keep being right after it was built. The arithmetic is the same on the
 * server as in the browser; what matters is that it is done at render, not at
 * write.
 */
export function Deadline({ end }: { end: string | null }) {
  const left = daysLeft(end);
  if (left === null) return null;
  if (left < 0) return <span className="text-[0.78rem] text-ink-30">Closed {formatDate(end)}</span>;
  if (left === 0) return <span className="text-[0.78rem] font-medium text-[#c0392b]">Last day today</span>;
  return (
    <span className={`text-[0.78rem] ${left <= 7 ? "font-medium text-[#8a5a12]" : "text-ink-50"}`}>
      {left} day{left === 1 ? "" : "s"} left · {formatDate(end)}
    </span>
  );
}

/**
 * One row in a list of notices.
 *
 * It links to the exam page, never straight out to the official PDF. That is
 * the whole difference from the sites this competes with: arriving from
 * "SSC CGL result" should land somewhere that also tells you the next exam
 * date and whether the answer key is out, not on a PDF with no way back.
 */
export function NoticeRow({ notice }: { notice: Notice }) {
  const href = notice.examSlug
    ? `/government-jobs/${notice.examSlug}`
    : notice.officialUrl;
  const external = !notice.examSlug;

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9rem] leading-snug text-ink group-hover:underline">
          {notice.title}
        </span>
        {notice.organisation && (
          <span className="mt-0.5 block text-[0.76rem] text-ink-30">{notice.organisation}</span>
        )}
      </span>
      {/* No date, no column. A dash on every row is a column of dashes
          pretending to be information — most of these boards do not date
          their links, and saying so forty times is worse than not saying it. */}
      {notice.publishedOn && (
        <span className="shrink-0 whitespace-nowrap pt-0.5 text-[0.74rem] text-ink-30">
          {formatDate(notice.publishedOn)}
        </span>
      )}
    </>
  );

  return (
    <li className="border-b border-ink-08 last:border-0">
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="group flex gap-3 py-2.5"
        >
          {body}
        </a>
      ) : (
        <Link href={href} className="group flex gap-3 py-2.5">
          {body}
        </Link>
      )}
      {notice.stale && (
        <p className="pb-2.5 text-[0.72rem] text-[#8a5a12]">
          The official link stopped responding when we last checked.
        </p>
      )}
    </li>
  );
}

/** A hub column, or a section of one. */
/**
 * A hub column.
 *
 * `self-start` on the section and `items-start` on the grid are the fix for
 * the thing that made this page look broken: in a CSS grid every cell
 * stretches to the tallest row by default, so a column with two rows was
 * drawn 760 pixels tall beside the column with nine, and the page carried
 * three enormous panels of white. A card is as tall as what is in it.
 *
 * An empty column shows one line and no "See all". A link to a page that is
 * also empty is a dead end dressed up as navigation.
 */
export function NoticeColumn({
  title,
  kind,
  notices,
}: {
  title: string;
  kind: keyof typeof KIND_SLUG;
  notices: Notice[];
}) {
  const empty = notices.length === 0;

  return (
    <section className="self-start rounded-2xl border border-ink-08 bg-paper p-4 sm:p-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em]">{title}</h2>
        {!empty && (
          <Link
            href={`/government-jobs/${KIND_SLUG[kind]}`}
            className="text-[0.76rem] text-ink-30 transition-colors hover:text-ink"
          >
            See all
          </Link>
        )}
      </div>

      {empty ? (
        <p className="text-[0.82rem] leading-relaxed text-ink-30">
          Nothing published in this section yet.
        </p>
      ) : (
        <ul>
          {notices.map((n) => (
            <NoticeRow key={n.id} notice={n} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One recruitment, as a card. Used by Closing soon and the dated lists.
 *
 * Shows only what the row can stand behind — the organisation and the name
 * always, the deadline and the vacancy count when each has provenance. A card
 * with two facts on it is better than a card with five, three of which were
 * guessed.
 */
export function ExamCard({
  exam,
}: {
  exam: {
    slug: string;
    organisation: string;
    name: string;
    vacancies: number | null;
    applicationEnd: string | null;
    shown: Set<string>;
  };
}) {
  return (
    <Link
      href={`/government-jobs/${exam.slug}`}
      className="flex h-full flex-col gap-2 rounded-2xl border border-ink-08 bg-paper p-4 transition-colors hover:border-ink-30"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[0.74rem] font-medium uppercase tracking-[0.1em] text-ink-30">
          {exam.organisation}
        </span>
        <StatusPill exam={exam} />
      </div>
      <span className="text-[0.94rem] font-medium leading-snug">{exam.name}</span>
      <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <Deadline end={verifiedDeadline(exam)} />
        {exam.shown.has("vacancies") && exam.vacancies && (
          <span className="text-[0.78rem] text-ink-50">
            {exam.vacancies.toLocaleString("en-IN")} posts
          </span>
        )}
      </span>
    </Link>
  );
}
