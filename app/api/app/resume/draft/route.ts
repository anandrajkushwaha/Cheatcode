import { createAppServerClient, getSessionUser } from "@/lib/supabase/app";
import { getPrimaryResume, getProfile, type ResumeDraft } from "@/lib/app/account";
import { cleanDraft, draftIsEmpty, scoreDraft, seedFromResume } from "@/lib/app/resume-draft";

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

const COLUMNS =
  "id,user_id,source_resume_id,title,content,ats_score,ats_result,is_primary,created_at,updated_at";

/**
 * A missing table is a deployment that has not run the migration, and saying
 * so is more useful than "relation does not exist" — to me now and to whoever
 * reads the logs later.
 */
const missingTable = (message?: string) =>
  Boolean(message && /relation .*resume_drafts.* does not exist|schema cache/i.test(message));

const notSetUp = () =>
  bad("The resume builder isn't set up on this deployment yet — run supabase/schemas/50_resume_drafts.sql.", 503);

async function context() {
  const user = await getSessionUser();
  if (!user) return { error: bad("Not signed in", 401) } as const;

  const supabase = await createAppServerClient();
  if (!supabase) return { error: bad("Accounts aren't configured on this deployment.", 503) } as const;

  return { user, supabase } as const;
}

/* -------------------------------------------------------------------- read */

/** The draft they are working on, or null. Never creates one. */
export async function GET() {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("resume_drafts")
    .select(COLUMNS)
    .order("is_primary", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) return missingTable(error.message) ? notSetUp() : bad(error.message, 500);

  return Response.json({ ok: true, draft: ((data ?? [])[0] as ResumeDraft) ?? null });
}

/* ------------------------------------------------------------------ create */

/**
 * Start a draft from the resume they already uploaded.
 *
 * Idempotent by default, because the button that calls this is one somebody
 * will double-click: an existing draft comes back untouched rather than being
 * overwritten by a fresh copy of an older document. `restart: true` is the
 * explicit way to throw away the edits and copy the resume again, and it is a
 * different request precisely so it cannot happen by accident.
 */
export async function POST(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { user, supabase } = ctx;

  let restart = false;
  try {
    const body = (await request.json()) as { restart?: boolean } | null;
    restart = body?.restart === true;
  } catch {
    // No body is the ordinary case: "give me my draft, make one if you must."
  }

  const { data: existing, error: readError } = await supabase
    .from("resume_drafts")
    .select(COLUMNS)
    .order("is_primary", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);

  if (readError) return missingTable(readError.message) ? notSetUp() : bad(readError.message, 500);

  const current = ((existing ?? [])[0] as ResumeDraft) ?? null;
  if (current && !restart) return Response.json({ ok: true, draft: current, created: false });

  const [resume, profile] = await Promise.all([getPrimaryResume(), getProfile()]);
  const content = cleanDraft(seedFromResume(resume, profile));

  if (draftIsEmpty(content)) {
    return bad(
      "There's nothing to build from yet. Upload a resume first, or fill in your profile, and " +
        "the builder will start with what you've already given us.",
    );
  }

  const result = scoreDraft(content);
  const row = {
    user_id: user.id,
    source_resume_id: resume?.id ?? null,
    title: content.full_name ? `${content.full_name} — resume` : "My resume",
    content,
    ats_score: result.score,
    ats_result: result,
    is_primary: true,
  };

  if (current) {
    // Restarting reuses the row rather than making a second one, so the
    // "one primary per person" index never has to be argued with and the
    // draft keeps whatever the agent has already been told about it.
    const { data, error } = await supabase
      .from("resume_drafts")
      .update(row)
      .eq("id", current.id)
      .eq("user_id", user.id)
      .select(COLUMNS)
      .limit(1);

    if (error) return bad(error.message, 500);
    return Response.json({ ok: true, draft: (data ?? [])[0] ?? null, created: false });
  }

  // Clear first, then insert. The partial unique index allows exactly one
  // primary row per person, so the other order fails on the constraint.
  await supabase.from("resume_drafts").update({ is_primary: false }).eq("user_id", user.id);

  const { data, error } = await supabase.from("resume_drafts").insert(row).select(COLUMNS).limit(1);
  if (error) return missingTable(error.message) ? notSetUp() : bad(error.message, 500);

  return Response.json({ ok: true, draft: (data ?? [])[0] ?? null, created: true });
}

/* -------------------------------------------------------------------- save */

/**
 * Save the content, and re-score it in the same breath.
 *
 * The score is computed here rather than accepted from the browser for the
 * obvious reason — a number the client can set is not a measurement — and by
 * the same `scoreDraft` an upload goes through, so "79 → 87" is one scale and
 * not two.
 */
export async function PUT(request: Request) {
  const ctx = await context();
  if ("error" in ctx) return ctx.error;
  const { user, supabase } = ctx;

  let body: { id?: string; title?: string; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad("Could not read that request.");
  }

  if (!body.id) return bad("No draft named.");

  const content = cleanDraft(body.content);
  const result = scoreDraft(content);

  const patch: Record<string, unknown> = {
    content,
    ats_score: result.score,
    ats_result: result,
  };
  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim().slice(0, 120);
  }

  // RLS already restricts this to their own rows; the explicit user_id makes
  // that obvious when read, and costs nothing.
  const { data, error } = await supabase
    .from("resume_drafts")
    .update(patch)
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select(COLUMNS)
    .limit(1);

  if (error) return missingTable(error.message) ? notSetUp() : bad(error.message, 500);

  const draft = (data ?? [])[0] ?? null;
  if (!draft) return bad("That draft doesn't exist.", 404);

  return Response.json({ ok: true, draft, score: result.score, result });
}
