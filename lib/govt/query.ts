import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import {
  GATED_FIELDS,
  verifiedDeadline,
  type Exam,
  type ExamWithNotices,
  type Notice,
  type NoticeKind,
} from "@/lib/govt/types";
import { lifecycleOf } from "@/lib/govt/lifecycle";
import { classifyGovtError } from "@/lib/govt/db-error";

/**
 * Reading government notices.
 *
 * Read on the server, directly, rather than through a route handler: these
 * pages are public, cacheable and the whole SEO case for the feature, and a
 * `fetch` to our own API from a server component costs a round trip and loses
 * the static render.
 *
 * The service-role client is used even though the RLS policies would allow an
 * anonymous read. One reason: the policies exist so that a draft cannot leak
 * if anything ever does reach these tables from a browser, and every query
 * here states `status = 'published'` itself. Two walls, one of them visible in
 * the query somebody is reading.
 */

const EXAM_COLS =
  "id, slug, organisation, organisation_type, name, year, qualification_levels, qualification_text, " +
  "states, is_all_india, age_min, age_max, vacancies, application_start, application_end, apply_url, " +
  "fee_by_category, exam_date_from, exam_date_to, date_note, selection_process, about, evidence, status";

const NOTICE_COLS =
  "id, kind, title, summary, published_on, official_url, status, exam_id";

type ExamRow = {
  id: string;
  slug: string;
  organisation: string;
  organisation_type: string;
  name: string;
  year: number | null;
  qualification_levels: string[] | null;
  qualification_text: string | null;
  states: string[] | null;
  is_all_india: boolean;
  age_min: number | null;
  age_max: number | null;
  vacancies: number | null;
  application_start: string | null;
  application_end: string | null;
  apply_url: string | null;
  fee_by_category: Record<string, number> | null;
  exam_date_from: string | null;
  exam_date_to: string | null;
  date_note: string | null;
  selection_process: string[] | null;
  about: string | null;
  evidence: Record<string, unknown> | null;
  status: Exam["status"];
};

type NoticeRow = {
  id: string;
  kind: NoticeKind;
  title: string;
  summary: string | null;
  published_on: string | null;
  official_url: string;
  status: string;
  exam_id: string | null;
};

/**
 * Which fields this row is allowed to show.
 *
 * Only the dangerous ones are gated — a title or an organisation needs no
 * provenance. The six here are the ones where being wrong costs somebody
 * money or a career opportunity, so each is shown only if the extractor (or
 * the admin form) recorded where it came from.
 */

function shownFields(evidence: Record<string, unknown> | null): Set<string> {
  const out = new Set<string>();
  if (!evidence) return out;
  for (const key of GATED_FIELDS) if (evidence[key]) out.add(key);
  return out;
}

function toExam(r: ExamRow): Exam {
  return {
    id: r.id,
    slug: r.slug,
    organisation: r.organisation,
    organisationType: r.organisation_type,
    name: r.name,
    year: r.year,
    qualificationLevels: r.qualification_levels ?? [],
    qualificationText: r.qualification_text,
    states: r.states ?? [],
    isAllIndia: r.is_all_india,
    ageMin: r.age_min,
    ageMax: r.age_max,
    vacancies: r.vacancies,
    applicationStart: r.application_start,
    applicationEnd: r.application_end,
    applyUrl: r.apply_url,
    feeByCategory: r.fee_by_category,
    examDateFrom: r.exam_date_from,
    examDateTo: r.exam_date_to,
    dateNote: r.date_note,
    selectionProcess: r.selection_process ?? [],
    about: r.about,
    status: r.status,
    shown: shownFields(r.evidence),
  };
}

function toNotice(r: NoticeRow, exam?: { slug: string; name: string; organisation: string }): Notice {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    publishedOn: r.published_on,
    officialUrl: r.official_url,
    stale: r.status === "stale",
    examSlug: exam?.slug ?? null,
    examName: exam?.name ?? null,
    organisation: exam?.organisation ?? null,
  };
}

/**
 * The newest notices of one kind, for a hub column or a kind page.
 *
 * Two queries rather than a join, because PostgREST's embedded select on a
 * nullable foreign key is awkward to type and this is two indexed lookups on
 * a table that will hold thousands of rows, not millions.
 */
export async function getNotices(kind: NoticeKind, limit = 12): Promise<Notice[]> {
  return (await getNoticesResult(kind, limit)).notices;
}

/**
 * The same read, with the reason it came back empty.
 *
 * Needed because "no rows" and "no tables" look identical from the outside
 * and mean opposite things. The hub was telling a visitor "nothing published
 * yet" on a deployment where the migration had simply never been run, which
 * is a page lying about its own state — and lying in the one direction that
 * stops anybody investigating.
 */
export async function getNoticesResult(
  kind: NoticeKind,
  limit = 12,
): Promise<{ notices: Notice[]; setup: boolean; error?: string }> {
  const db = createAppAdminClient();
  if (!db) return { notices: [], setup: true, error: "Accounts aren't configured on this deployment." };

  const { data, error } = await db
    .from("govt_notices")
    .select(NOTICE_COLS)
    .eq("kind", kind)
    .in("status", ["published", "stale"])
    .order("published_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // PostgREST answers a missing table with 42P01, and with PGRST205 when
    // its schema cache has never seen the name. Both mean the same thing to
    // somebody looking at an empty page: the SQL has not been run.
    const missing =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /relation .*govt_notices.* does not exist/i.test(error.message) ||
      /could not find the table/i.test(error.message);
    return {
      notices: [],
      setup: missing,
      error: missing
        ? "Government notices aren't set up in this database yet — run supabase/schemas/100_govt_notices.sql."
        : error.message,
    };
  }
  if (!data) return { notices: [], setup: false };
  const rows = data as NoticeRow[];

  const examIds = [...new Set(rows.map((r) => r.exam_id).filter((x): x is string => Boolean(x)))];
  const exams = await examsById(examIds);
  return {
    notices: rows.map((r) => toNotice(r, r.exam_id ? exams.get(r.exam_id) : undefined)),
    setup: false,
  };
}

async function examsById(ids: string[]) {
  const map = new Map<string, { slug: string; name: string; organisation: string }>();
  if (ids.length === 0) return map;

  const db = createAppAdminClient();
  if (!db) return map;

  const { data } = await db
    .from("govt_exams")
    .select("id, slug, name, organisation")
    .in("id", ids);

  for (const row of (data ?? []) as { id: string; slug: string; name: string; organisation: string }[]) {
    map.set(row.id, { slug: row.slug, name: row.name, organisation: row.organisation });
  }
  return map;
}

/**
 * One exam and every notice attached to it, oldest stage first.
 *
 * `retired` rows are fetched too, and the page says so rather than 404ing.
 * These URLs were published and are indexed; somebody arriving from a search
 * is better served by "this listing was withdrawn, here is the directory"
 * than by a page that denies it ever existed.
 */
export async function getExam(slug: string): Promise<ExamWithNotices | null> {
  const db = createAppAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("govt_exams")
    .select(EXAM_COLS)
    .eq("slug", slug)
    .in("status", ["published", "closed", "retired"])
    .maybeSingle();

  if (error || !data) return null;
  const exam = toExam(data as unknown as ExamRow);

  const { data: notices } = await db
    .from("govt_notices")
    .select(NOTICE_COLS)
    .eq("exam_id", exam.id)
    .in("status", exam.status === "retired" ? ["published", "stale", "retired"] : ["published", "stale"])
    .order("published_on", { ascending: true, nullsFirst: false });

  return {
    ...exam,
    notices: ((notices ?? []) as NoticeRow[]).map((r) =>
      toNotice(r, { slug: exam.slug, name: exam.name, organisation: exam.organisation }),
    ),
  };
}

/** Every published slug, for the sitemap and for static params. */
export async function getExamSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const db = createAppAdminClient();
  if (!db) return [];

  const { data } = await db
    .from("govt_exams")
    .select("slug, updated_at")
    .in("status", ["published", "closed"])
    .order("updated_at", { ascending: false })
    .limit(5000);

  return ((data ?? []) as { slug: string; updated_at: string }[]).map((r) => ({
    slug: r.slug,
    updatedAt: r.updated_at,
  }));
}

/**
 * Recruitments by where they are in their deadline, derived not stored.
 *
 * The lifecycle is worked out at read time by the same function the badges
 * use, so a row cannot be in the Closing soon list while its own badge says
 * Open. The database narrows; `lifecycleOf` decides.
 *
 * Rows with no verified closing date never reach any of these buckets. They
 * are not "open" and not "closed" — nobody knows — and `getUndated` is where
 * they live, labelled as exactly that.
 */
async function publishedExams(limit: number): Promise<Exam[]> {
  const db = createAppAdminClient();
  if (!db) return [];

  const { data } = await db
    .from("govt_exams")
    .select(EXAM_COLS)
    .eq("status", "published")
    .order("application_end", { ascending: true, nullsFirst: false })
    .limit(limit);

  return ((data ?? []) as unknown as ExamRow[]).map(toExam);
}

/** Closing within CLOSING_SOON_DAYS, nearest deadline first. */
export async function getClosingSoon(limit = 12): Promise<Exam[]> {
  const all = await publishedExams(400);
  return all
    .filter((e) => lifecycleOf(verifiedDeadline(e)) === "closing_soon")
    .slice(0, limit);
}

/** Verified deadline still ahead, beyond the closing-soon window. */
export async function getOpen(limit = 40): Promise<Exam[]> {
  const all = await publishedExams(400);
  return all.filter((e) => lifecycleOf(verifiedDeadline(e)) === "open").slice(0, limit);
}

/**
 * Closed, kept rather than deleted.
 *
 * A deadline passing is not a reason to remove a page: the searches continue
 * for months, the page has whatever authority it earned, and a 404 serves
 * somebody worse than a page that says "this closed on 20 Oct" and points at
 * what is open now.
 */
export async function getClosed(limit = 60): Promise<Exam[]> {
  const all = await publishedExams(400);
  return all
    .filter((e) => lifecycleOf(verifiedDeadline(e)) === "closed")
    .reverse()
    .slice(0, limit);
}

/**
 * Published, and we do not know when it closes.
 *
 * Deliberately its own list rather than folded into Latest Jobs. Most of
 * these notices are real; what is missing is a date nobody has verified, and
 * showing them beside a heading that says "open" would be making the claim
 * for them.
 */
export async function getUndated(limit = 60): Promise<Exam[]> {
  const all = await publishedExams(400);
  return all.filter((e) => lifecycleOf(verifiedDeadline(e)) === "unknown").slice(0, limit);
}

/* ----------------------------------------------------------------- admin */

export type SourceRow = {
  id: string;
  name: string;
  organisation: string;
  listUrl: string | null;
  kind: string;
  active: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastCount: number;
  lastError: string | null;
};

export type GovtStatus =
  | { ok: false; setup: boolean; error: string }
  | {
      ok: true;
      sources: SourceRow[];
      exams: number;
      notices: number;
      published: number;
      reports: number;
    };

/**
 * What state this feature is actually in.
 *
 * Written for the one question that cannot be answered by looking at the
 * public page: is it empty because nothing has been ingested, or because the
 * tables do not exist? Both look the same to a visitor, and only one of them
 * is something to wait for.
 */
export async function getGovtStatus(): Promise<GovtStatus> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, setup: true, error: "Accounts aren't configured on this deployment." };

  const { data, error } = await db
    .from("govt_sources")
    .select("id, name, organisation, list_url, kind, active, last_run_at, last_status, last_count, last_error")
    .order("organisation", { ascending: true });

  if (error) {
    // Classified rather than pattern-matched: "does not exist" is also what a
    // missing column says, and sending somebody to re-run a migration they
    // have already run is the one error message worse than none.
    const kind = classifyGovtError(error);
    return { ok: false, setup: kind.kind !== "other", error: kind.message };
  }

  const head = async (table: string, filter?: (q: ReturnType<typeof countQuery>) => unknown) => {
    const q = countQuery(table);
    if (filter) filter(q);
    const { count } = (await q) as { count: number | null };
    return count ?? 0;
  };
  function countQuery(table: string) {
    return db!.from(table).select("id", { count: "exact", head: true });
  }

  const [exams, notices, published, reports] = await Promise.all([
    head("govt_exams"),
    head("govt_notices"),
    head("govt_notices", (q) => q.eq("status", "published")),
    head("govt_error_reports", (q) => q.eq("resolved", false)),
  ]);

  const sources = (
    (data ?? []) as {
      id: string;
      name: string;
      organisation: string;
      list_url: string | null;
      kind: string;
      active: boolean;
      last_run_at: string | null;
      last_status: string | null;
      last_count: number;
      last_error: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    organisation: r.organisation,
    listUrl: r.list_url,
    kind: r.kind,
    active: r.active,
    lastRunAt: r.last_run_at,
    lastStatus: r.last_status,
    lastCount: r.last_count,
    lastError: r.last_error,
  }));

  return { ok: true, sources, exams, notices, published, reports };
}
