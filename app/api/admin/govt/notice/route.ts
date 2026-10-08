import { requireAdmin } from "@/lib/admin/guard";
import { adminDisplayName } from "@/lib/admin/who";
import { createAppAdminClient } from "@/lib/supabase/app";
import { refreshGovt } from "@/lib/govt/refresh";
import { insertTolerant } from "@/lib/govt/db-error";
import { NOTICE_KINDS, type NoticeKind } from "@/lib/govt/types";

export const dynamic = "force-dynamic";

/**
 * Posting a notice by hand.
 *
 *   { action: "save",   id?, kind, title, summary?, publishedOn?, officialUrl, examId?, status }
 *   { action: "status", id, status }      publish / unpublish / withdraw
 *   { action: "delete", id }              owner only
 *
 * Anybody with the Government jobs section can post and edit. Deleting stays
 * with the owner, the same rule as articles and insights: an editor can take
 * something down, which is reversible, but cannot make it as if it had never
 * existed — these rows are what a public URL and a sitemap entry point at.
 *
 * Every field here is typed by a person reading an official notification, so
 * there is no extractor to distrust and no evidence to demand. What is
 * demanded is the link: a notice without the official page it came from is
 * not a notice, it is a claim, and the one thing a reader must always be able
 * to do on these pages is go and check.
 */

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

type Body = {
  action?: string;
  id?: string;
  kind?: string;
  title?: string;
  summary?: string;
  publishedOn?: string;
  officialUrl?: string;
  examId?: string | null;
  status?: string;
};

/** What a notice may be. 'stale' and 'retired' are written by machines, not here. */
const STATUSES = new Set(["published", "draft", "withdrawn"]);

const isKind = (k: string): k is NoticeKind => (NOTICE_KINDS as readonly string[]).includes(k);

/**
 * Government links. http as well as https, deliberately.
 *
 * A good number of state board and NIC pages are still served over plain
 * http, and refusing them would mean refusing the real source in favour of
 * nothing. We only ever link out to these, never embed or post to them.
 */
const LINK = /^https?:\/\/[^\s]+$/i;

/** A date, and a sane one. Notifications are dated, not timestamped. */
function dateProblem(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "The date needs to be a real date.";
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return "That date does not exist.";
  const year = Number(iso.slice(0, 4));
  if (year < 2015) return "That date is too far back to be a current notice.";
  if (t > Date.now() + 730 * 86_400_000) return "That date is more than two years away.";
  return null;
}

export async function POST(request: Request) {
  const guard = await requireAdmin("govt");
  if (!guard.ok) return guard.response;
  const { session } = guard;

  const db = createAppAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Could not read that request.");
  }

  // ------------------------------------------------------------- status
  if (body.action === "status") {
    if (!body.id) return bad("Which notice?");
    const next = body.status ?? "";
    if (!STATUSES.has(next)) return bad("Unknown status.");

    const { data, error } = await db
      .from("govt_notices")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .select("exam_id")
      .maybeSingle();
    if (error) return bad(error.message, 500);

    refreshGovt(await slugOfExam(db, (data as { exam_id: string | null } | null)?.exam_id ?? null));
    return Response.json({ ok: true });
  }

  // --------------------------------------------------- publish the batch
  //
  // The working shape is a batch: several jobs read off a board in one
  // sitting, then put up together. Scoped to drafts, so it can never
  // resurrect something that was withdrawn on purpose.
  if (body.action === "publish_all") {
    const { data, error } = await db
      .from("govt_notices")
      .update({ status: "published", updated_at: new Date().toISOString() })
      .eq("status", "draft")
      .select("id");
    if (error) return bad(error.message, 500);

    refreshGovt();
    return Response.json({ ok: true, published: (data ?? []).length });
  }

  // ------------------------------------------------------------- delete
  if (body.action === "delete") {
    if (session.role !== "owner") {
      return bad("Only the owner can delete. Withdraw it instead — that takes it off the page.", 403);
    }
    if (!body.id) return bad("Which notice?");

    const { data } = await db
      .from("govt_notices")
      .select("exam_id")
      .eq("id", body.id)
      .maybeSingle();
    const { error } = await db.from("govt_notices").delete().eq("id", body.id);
    if (error) return bad(error.message, 500);

    refreshGovt(await slugOfExam(db, (data as { exam_id: string | null } | null)?.exam_id ?? null));
    return Response.json({ ok: true });
  }

  if (body.action !== "save") return bad("Unknown action.");

  // ----------------------------------------------------------- validate
  const kind = (body.kind ?? "").trim();
  const title = (body.title ?? "").replace(/\s+/g, " ").trim();
  const summary = (body.summary ?? "").replace(/[ \t]+/g, " ").trim();
  const officialUrl = (body.officialUrl ?? "").trim();
  const publishedOn = (body.publishedOn ?? "").trim();
  const status = body.status ?? "published";
  const examId = body.examId || null;

  if (!isKind(kind)) return bad("Pick what kind of notice this is.");
  if (title.length < 8) return bad("Add a title — the one the notification itself uses.");
  if (title.length > 240) return bad("Keep the title under 240 characters.");
  if (summary.length > 600) return bad("Keep the one-line summary under 600 characters.");
  if (!LINK.test(officialUrl)) return bad("Add the official link, starting with http:// or https://");
  if (officialUrl.length > 1000) return bad("That link is too long to store.");
  if (publishedOn) {
    const problem = dateProblem(publishedOn);
    if (problem) return bad(problem);
  }
  if (!STATUSES.has(status)) return bad("Unknown status.");

  // A notice may stand alone — most results and admit cards do, and forcing a
  // recruitment page to exist first would mean inventing one. But if a
  // recruitment is named, it has to be a real one that is not withdrawn:
  // attaching a notice to a retired listing publishes it onto a page that
  // tells readers the listing was withdrawn.
  let examSlug: string | null = null;
  if (examId) {
    const { data } = await db
      .from("govt_exams")
      .select("slug, status")
      .eq("id", examId)
      .maybeSingle();
    const exam = data as { slug: string; status: string } | null;
    if (!exam) return bad("That recruitment no longer exists. Leave it unattached or pick another.");
    if (exam.status === "retired" || exam.status === "withdrawn") {
      return bad("That recruitment has been withdrawn, so a notice cannot be attached to it.");
    }
    examSlug = exam.slug;
  }

  const fields = {
    kind,
    title,
    summary: summary || null,
    published_on: publishedOn || null,
    official_url: officialUrl,
    exam_id: examId,
    status,
    updated_at: new Date().toISOString(),
  };

  if (body.id) {
    // The slug of whatever it used to hang off, so detaching a notice also
    // refreshes the page it is leaving.
    const { data: before } = await db
      .from("govt_notices")
      .select("exam_id")
      .eq("id", body.id)
      .maybeSingle();

    const { error } = await db.from("govt_notices").update(fields).eq("id", body.id);
    if (error) return bad(friendly(error.message), 500);

    const wasSlug = await slugOfExam(db, (before as { exam_id: string | null } | null)?.exam_id ?? null);
    refreshGovt(examSlug);
    if (wasSlug && wasSlug !== examSlug) refreshGovt(wasSlug);
    return Response.json({ ok: true, id: body.id });
  }

  const { data, error } = await insertTolerant<{ id: string }>(
    (row) => db.from("govt_notices").insert(row).select("id").single(),
    { ...fields, posted_by: await adminDisplayName(session), last_seen_at: new Date().toISOString() },
  );

  if (error) return bad(friendly(error.message), 500);

  refreshGovt(examSlug);
  return Response.json({ ok: true, id: data?.id });
}

/**
 * Database errors, in the words of the person who hit them.
 *
 * The unique index on official_url is the one that fires in practice: two
 * people posting the same notification, or one person posting it twice an
 * hour apart. "duplicate key value violates unique constraint" tells them
 * nothing about what to do; "it is already posted, open it from the list"
 * tells them exactly.
 */
function friendly(message: string): string {
  if (/duplicate|unique/i.test(message)) {
    return "That official link is already posted. Open it from the list and edit that one instead.";
  }
  if (/posted_by|column .* does not exist|schema cache/i.test(message)) {
    return "The tables are a version behind — run supabase/schemas/105_govt_manual_posting.sql.";
  }
  if (/violates check constraint/i.test(message)) {
    return "The database refused one of those values. Check the kind and the status.";
  }
  return message;
}

async function slugOfExam(
  db: NonNullable<ReturnType<typeof createAppAdminClient>>,
  examId: string | null,
): Promise<string | null> {
  if (!examId) return null;
  const { data } = await db.from("govt_exams").select("slug").eq("id", examId).maybeSingle();
  return (data as { slug: string } | null)?.slug ?? null;
}
