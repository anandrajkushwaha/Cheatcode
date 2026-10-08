import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import {
  type Exam,
  type ExamWithNotices,
  type Notice,
  type NoticeKind,
} from "@/lib/govt/types";

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
const GATED = [
  "application_start",
  "application_end",
  "fee_by_category",
  "vacancies",
  "age_min",
  "age_max",
] as const;

function shownFields(evidence: Record<string, unknown> | null): Set<string> {
  const out = new Set<string>();
  if (!evidence) return out;
  for (const key of GATED) if (evidence[key]) out.add(key);
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
  const db = createAppAdminClient();
  if (!db) return [];

  const { data, error } = await db
    .from("govt_notices")
    .select(NOTICE_COLS)
    .eq("kind", kind)
    .in("status", ["published", "stale"])
    .order("published_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  const rows = data as NoticeRow[];

  const examIds = [...new Set(rows.map((r) => r.exam_id).filter((x): x is string => Boolean(x)))];
  const exams = await examsById(examIds);
  return rows.map((r) => toNotice(r, r.exam_id ? exams.get(r.exam_id) : undefined));
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

/** One exam and every notice attached to it, oldest stage first. */
export async function getExam(slug: string): Promise<ExamWithNotices | null> {
  const db = createAppAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("govt_exams")
    .select(EXAM_COLS)
    .eq("slug", slug)
    .in("status", ["published", "closed"])
    .maybeSingle();

  if (error || !data) return null;
  const exam = toExam(data as unknown as ExamRow);

  const { data: notices } = await db
    .from("govt_notices")
    .select(NOTICE_COLS)
    .eq("exam_id", exam.id)
    .in("status", ["published", "stale"])
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
 * Recruitments still open, soonest deadline first.
 *
 * Rows with no stated closing date are deliberately excluded rather than
 * sorted last: this list's whole claim is "these close soon", and a row that
 * cannot support that claim does not belong in it.
 */
export async function getClosingSoon(limit = 10): Promise<Exam[]> {
  const db = createAppAdminClient();
  if (!db) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("govt_exams")
    .select(EXAM_COLS)
    .eq("status", "published")
    .gte("application_end", today)
    .order("application_end", { ascending: true })
    .limit(limit);

  return ((data ?? []) as unknown as ExamRow[]).map(toExam);
}
