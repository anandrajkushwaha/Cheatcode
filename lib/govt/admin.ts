import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { NOTICE_KINDS, type NoticeKind } from "@/lib/govt/types";

/**
 * Reading the government tables as the person who posts to them.
 *
 * Separate from query.ts on purpose. That file answers "what may a visitor
 * see", and every query in it states `status = 'published'` — which is
 * exactly the wrong shape here, where the useful screen is the one showing
 * the draft you half-finished and the row somebody retired this morning. Two
 * readers with opposite defaults are clearer than one with a flag.
 */

export type PanelNotice = {
  id: string;
  kind: NoticeKind;
  title: string;
  summary: string | null;
  publishedOn: string | null;
  officialUrl: string;
  status: string;
  examId: string | null;
  examName: string | null;
  examSlug: string | null;
  /** Typed by a person, rather than extracted. source_id is the test. */
  manual: boolean;
  postedBy: string | null;
  createdAt: string;
};

export type PanelExam = {
  id: string;
  slug: string;
  organisation: string;
  name: string;
  year: number | null;
  status: string;
  applicationEnd: string | null;
  vacancies: number | null;
  manual: boolean;
  postedBy: string | null;
  createdAt: string;
};

/** The whole recruitment row, as the edit form needs it. */
export type ExamDraft = PanelExam & {
  organisationType: string;
  qualificationLevels: string[];
  qualificationText: string | null;
  states: string[];
  isAllIndia: boolean;
  ageMin: number | null;
  ageMax: number | null;
  applicationStart: string | null;
  applyUrl: string | null;
  feeByCategory: Record<string, number> | null;
  examDateFrom: string | null;
  examDateTo: string | null;
  dateNote: string | null;
  selectionProcess: string[];
  about: string | null;
  /** Which gated fields already carry a note of where they came from. */
  evidenced: string[];
  evidenceUrl: string | null;
};

type Fail = { ok: false; setup: boolean; error: string };

/**
 * A missing table and an empty table are different sentences.
 *
 * The public hub learned this the hard way — it told visitors "nothing
 * published yet" on a deployment where the SQL had never been run. The admin
 * screen is where that difference has to be legible, so it is detected here
 * rather than guessed from a row count.
 */
function missingTable(error: { code?: string; message: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist/i.test(error.message) ||
    /could not find the table/i.test(error.message)
  );
}

function fail(error: { code?: string; message: string }): Fail {
  const setup = missingTable(error);
  return {
    ok: false,
    setup,
    error: setup
      ? "The government tables aren't in this database yet — run supabase/schemas/100_govt_notices.sql, then 104 and 105."
      : error.message,
  };
}

const NOTICE_COLS =
  "id, kind, title, summary, published_on, official_url, status, exam_id, source_id, posted_by, created_at";

const EXAM_LIST_COLS =
  "id, slug, organisation, name, year, status, application_end, vacancies, source_id, posted_by, created_at";

type NoticeRow = {
  id: string;
  kind: NoticeKind;
  title: string;
  summary: string | null;
  published_on: string | null;
  official_url: string;
  status: string;
  exam_id: string | null;
  source_id: string | null;
  posted_by: string | null;
  created_at: string;
};

type ExamRow = {
  id: string;
  slug: string;
  organisation: string;
  name: string;
  year: number | null;
  status: string;
  application_end: string | null;
  vacancies: number | null;
  source_id: string | null;
  posted_by: string | null;
  created_at: string;
};

function toPanelExam(r: ExamRow): PanelExam {
  return {
    id: r.id,
    slug: r.slug,
    organisation: r.organisation,
    name: r.name,
    year: r.year,
    status: r.status,
    applicationEnd: r.application_end,
    vacancies: r.vacancies,
    manual: r.source_id === null,
    postedBy: r.posted_by,
    createdAt: r.created_at,
  };
}

export type Panel = {
  ok: true;
  notices: PanelNotice[];
  exams: PanelExam[];
  /** Published notices per kind — what a reader would find on each tab. */
  live: Record<NoticeKind, number>;
  drafts: number;
  retired: number;
  /** Boards still switched on. Zero means the monitor is paused. */
  activeSources: number;
};

/**
 * Everything the panel's first screen shows, in one place.
 *
 * Deliberately one function returning one object rather than six exported
 * queries the page assembles: the counts and the list have to agree with each
 * other, and the cheapest way to guarantee that is for them to be read in the
 * same breath.
 */
export async function getPanel(filter: {
  kind?: NoticeKind | null;
  status?: string | null;
  limit?: number;
}): Promise<Panel | Fail> {
  const db = createAppAdminClient();
  if (!db) {
    return { ok: false, setup: true, error: "Supabase isn't configured on this deployment." };
  }

  let q = db.from("govt_notices").select(NOTICE_COLS).order("created_at", { ascending: false });
  if (filter.kind) q = q.eq("kind", filter.kind);
  if (filter.status) q = q.eq("status", filter.status);

  const { data, error } = await q.limit(filter.limit ?? 100);
  if (error) return fail(error);

  const rows = (data ?? []) as NoticeRow[];

  const [{ data: examData, error: examError }, counts, sources] = await Promise.all([
    db.from("govt_exams").select(EXAM_LIST_COLS).order("created_at", { ascending: false }).limit(200),
    kindCounts(),
    db.from("govt_sources").select("id").eq("active", true),
  ]);
  if (examError) return fail(examError);

  const exams = ((examData ?? []) as ExamRow[]).map(toPanelExam);
  const byId = new Map(exams.map((e) => [e.id, e]));

  return {
    ok: true,
    notices: rows.map((r) => {
      const exam = r.exam_id ? byId.get(r.exam_id) : undefined;
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        summary: r.summary,
        publishedOn: r.published_on,
        officialUrl: r.official_url,
        status: r.status,
        examId: r.exam_id,
        examName: exam?.name ?? null,
        examSlug: exam?.slug ?? null,
        manual: r.source_id === null,
        postedBy: r.posted_by,
        createdAt: r.created_at,
      };
    }),
    exams,
    live: counts.live,
    drafts: counts.drafts,
    retired: counts.retired,
    activeSources: (sources.data ?? []).length,
  };
}

/**
 * How many notices a reader would actually find on each tab.
 *
 * Counted with `head: true`, so this is six index-only counts rather than six
 * lists nobody renders.
 */
async function kindCounts(): Promise<{
  live: Record<NoticeKind, number>;
  drafts: number;
  retired: number;
}> {
  const empty = Object.fromEntries(NOTICE_KINDS.map((k) => [k, 0])) as Record<NoticeKind, number>;
  const db = createAppAdminClient();
  if (!db) return { live: empty, drafts: 0, retired: 0 };

  const count = async (build: (q: ReturnType<typeof base>) => unknown) => {
    const q = base();
    build(q);
    const { count: n } = (await q) as { count: number | null };
    return n ?? 0;
  };
  function base() {
    return db!.from("govt_notices").select("id", { count: "exact", head: true });
  }

  const live = { ...empty };
  await Promise.all([
    ...NOTICE_KINDS.map(async (k) => {
      live[k] = await count((q) => q.eq("kind", k).in("status", ["published", "stale"]));
    }),
  ]);
  const [drafts, retired] = await Promise.all([
    count((q) => q.eq("status", "draft")),
    count((q) => q.in("status", ["retired", "withdrawn"])),
  ]);

  return { live, drafts, retired };
}

/** One notice, for the edit form. Any status — that is the point of the form. */
export async function getPanelNotice(id: string): Promise<PanelNotice | null> {
  const db = createAppAdminClient();
  if (!db) return null;

  const { data } = await db.from("govt_notices").select(NOTICE_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  const r = data as NoticeRow;

  let examName: string | null = null;
  let examSlug: string | null = null;
  if (r.exam_id) {
    const { data: e } = await db
      .from("govt_exams")
      .select("name, slug")
      .eq("id", r.exam_id)
      .maybeSingle();
    const row = e as { name: string; slug: string } | null;
    examName = row?.name ?? null;
    examSlug = row?.slug ?? null;
  }

  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    publishedOn: r.published_on,
    officialUrl: r.official_url,
    status: r.status,
    examId: r.exam_id,
    examName,
    examSlug,
    manual: r.source_id === null,
    postedBy: r.posted_by,
    createdAt: r.created_at,
  };
}

/** One recruitment, every field, for the edit form. */
export async function getExamDraft(id: string): Promise<ExamDraft | null> {
  const db = createAppAdminClient();
  if (!db) return null;

  const { data } = await db.from("govt_exams").select("*").eq("id", id).maybeSingle();
  if (!data) return null;

  const r = data as ExamRow & Record<string, unknown>;
  const evidence = (r.evidence ?? {}) as Record<string, { url?: string } | undefined>;
  const evidenced = Object.keys(evidence).filter((k) => evidence[k]);

  return {
    ...toPanelExam(r),
    organisationType: String(r.organisation_type ?? "state"),
    qualificationLevels: (r.qualification_levels as string[] | null) ?? [],
    qualificationText: (r.qualification_text as string | null) ?? null,
    states: (r.states as string[] | null) ?? [],
    isAllIndia: Boolean(r.is_all_india),
    ageMin: (r.age_min as number | null) ?? null,
    ageMax: (r.age_max as number | null) ?? null,
    applicationStart: (r.application_start as string | null) ?? null,
    applyUrl: (r.apply_url as string | null) ?? null,
    feeByCategory: (r.fee_by_category as Record<string, number> | null) ?? null,
    examDateFrom: (r.exam_date_from as string | null) ?? null,
    examDateTo: (r.exam_date_to as string | null) ?? null,
    dateNote: (r.date_note as string | null) ?? null,
    selectionProcess: (r.selection_process as string[] | null) ?? [],
    about: (r.about as string | null) ?? null,
    evidenced,
    evidenceUrl: evidenced.length ? (evidence[evidenced[0]]?.url ?? null) : null,
  };
}

/**
 * The recruitments a notice can be attached to, newest first.
 *
 * Retired ones are left out: attaching a new admit card to a listing we have
 * already withdrawn would publish the notice onto a page that tells readers
 * it is withdrawn.
 */
export async function getExamOptions(): Promise<{ id: string; label: string }[]> {
  const db = createAppAdminClient();
  if (!db) return [];

  const { data } = await db
    .from("govt_exams")
    .select("id, organisation, name, year, status")
    .in("status", ["draft", "published", "closed"])
    .order("created_at", { ascending: false })
    .limit(300);

  return ((data ?? []) as { id: string; organisation: string; name: string; year: number | null; status: string }[]).map(
    (e) => ({
      id: e.id,
      label: `${e.organisation} — ${e.name}${e.year ? ` ${e.year}` : ""}${e.status === "draft" ? " (draft)" : ""}`,
    }),
  );
}
