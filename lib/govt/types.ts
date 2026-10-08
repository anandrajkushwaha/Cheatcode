/**
 * The shapes the government-jobs pages read.
 *
 * Deliberately not `server-only`: the types travel into client components
 * (the filter rail, the save button), while every function that *fetches*
 * them lives in query.ts, which is.
 */

/** The six kinds of notice. Closed, and the order the hub draws them in. */
export const NOTICE_KINDS = [
  "job",
  "result",
  "admit_card",
  "answer_key",
  "syllabus",
  "admission",
] as const;

export type NoticeKind = (typeof NOTICE_KINDS)[number];

export const KIND_LABEL: Record<NoticeKind, string> = {
  job: "Latest Jobs",
  result: "Results",
  admit_card: "Admit Card",
  answer_key: "Answer Key",
  syllabus: "Syllabus",
  admission: "Admission",
};

/** The URL segment each kind lives at. */
export const KIND_SLUG: Record<NoticeKind, string> = {
  job: "latest-jobs",
  result: "results",
  admit_card: "admit-card",
  answer_key: "answer-key",
  syllabus: "syllabus",
  admission: "admission",
};

export const KIND_BY_SLUG: Record<string, NoticeKind> = Object.fromEntries(
  NOTICE_KINDS.map((k) => [KIND_SLUG[k], k]),
) as Record<string, NoticeKind>;

/**
 * The stages an exam passes through, in the order they happen.
 *
 * This list is why the feature exists. A stage with no notice yet is still
 * drawn — as "Not announced yet" — because the question somebody arrives with
 * is usually "has the admit card come out", and a page that answers it only
 * when the answer is yes has not answered it.
 */
export const LIFECYCLE: NoticeKind[] = ["job", "syllabus", "admit_card", "answer_key", "result"];

export const STAGE_LABEL: Record<NoticeKind, string> = {
  job: "Notification",
  syllabus: "Syllabus",
  admit_card: "Admit card",
  answer_key: "Answer key",
  result: "Result",
  admission: "Admission",
};

/**
 * Slugs an exam may never take.
 *
 * The six kind pages are static routes sitting beside `[slug]`, so Next would
 * serve the kind page and the exam would simply never be reachable — a row in
 * the database, published, indexed nowhere, with no error anywhere. Checked
 * when a slug is minted rather than discovered later.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...Object.values(KIND_SLUG),
  "by",
  "qualification",
  "state",
  "search",
  "closing-soon",
  "closed",
  "dates-not-stated",
]);

/**
 * The address a recruitment will live at, forever.
 *
 * Minted once and never recomputed, because a slug that changes when a title
 * is tidied is a dead Google result — and Google is the entire reason these
 * pages exist. Reserved words are refused outright: the six kind pages are
 * static routes sitting beside `[slug]`, so an exam minted at `results` would
 * be a published row that no URL can ever reach, erroring nowhere.
 *
 * Here rather than in the ingest run because it is pure, it belongs beside
 * the list it checks against, and a function this consequential should be
 * testable without a database and a browser.
 */
export function makeSlug(
  organisation: string,
  name: string,
  year: number | null,
): string | null {
  const base = `${organisation} ${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 8)
    .join("-");

  // The name has to contribute something. Without this, a notice whose exam
  // could not be named falls back to the organisation alone — "ssc" — and the
  // next unnamed SSC notice finds that row and attaches to it, until one page
  // called "SSC" holds forty unrelated notices. Better no exam than a wrong
  // one: the caller leaves exam_id null and the notice still publishes.
  if (!base.includes("-") || base.length < 3) return null;

  const slug = year && !base.includes(String(year)) ? `${base}-${year}` : base;
  return RESERVED_SLUGS.has(slug) ? null : slug.slice(0, 80);
}

export type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  summary: string | null;
  /** ISO date, or null when the source gave none. */
  publishedOn: string | null;
  officialUrl: string;
  /** A link that stopped resolving. Shown, but marked. */
  stale: boolean;
  examSlug: string | null;
  examName: string | null;
  organisation: string | null;
};

export type Exam = {
  id: string;
  slug: string;
  organisation: string;
  organisationType: string;
  name: string;
  year: number | null;
  qualificationLevels: string[];
  qualificationText: string | null;
  states: string[];
  isAllIndia: boolean;
  ageMin: number | null;
  ageMax: number | null;
  vacancies: number | null;
  applicationStart: string | null;
  applicationEnd: string | null;
  applyUrl: string | null;
  feeByCategory: Record<string, number> | null;
  examDateFrom: string | null;
  examDateTo: string | null;
  dateNote: string | null;
  selectionProcess: string[];
  about: string | null;
  status: "draft" | "published" | "closed" | "withdrawn" | "retired";
  /**
   * Which fields we can show.
   *
   * A value is rendered only when its name is in here. The column behind it
   * holds the sentence the value was read from; the page does not need the
   * sentence, only the fact that one exists — see the comment on `evidence`
   * in 100_govt_notices.sql for why a missing field is shown as missing
   * rather than guessed.
   */
  shown: Set<string>;
};

export type ExamWithNotices = Exam & { notices: Notice[] };

/**
 * The closing date we are allowed to show, or null.
 *
 * The lifecycle engine must never see a date the row cannot stand behind:
 * a value sitting in `application_end` with no entry in `evidence` was not
 * read off a notification, and deriving "Open" from it would be inventing a
 * deadline rather than reporting one. One accessor, so every caller asks the
 * same question.
 */
export function verifiedDeadline(exam: {
  applicationEnd: string | null;
  shown: Set<string>;
}): string | null {
  return exam.shown.has("application_end") ? exam.applicationEnd : null;
}

/** 20 Oct 2026. The format every one of these notifications uses. */
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
