import { getSessionUser } from "@/lib/supabase/app";
import { cleanResume } from "@/lib/app/resume-schema";
import { isTemplateId } from "@/lib/app/resume-templates";
import {
  ClearRefused,
  createFromTemplate,
  getDraft,
  getOrCreateDraft,
  patchDraft,
  reseedDraft,
  save,
  StoreError,
} from "@/lib/app/resume-store";

export const dynamic = "force-dynamic";

/**
 * The builder's door to the same store the agent writes through.
 *
 * This route used to own the create-and-save logic outright, which meant the
 * agent had no way to change a resume without duplicating it. All of that
 * moved to lib/app/resume-store.ts; what is left here is the HTTP shape.
 *
 * GET reads, POST makes sure one exists, PUT saves what the editor sent. Every
 * one of them re-scores through the same function an upload goes through, so
 * "79 → 91" is one scale and not two.
 */

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

function failed(e: unknown) {
  if (e instanceof ClearRefused) return bad(e.message, 409);
  if (e instanceof StoreError) return bad(e.message, e.status);
  console.error("resume/draft:", String(e).slice(0, 300));
  return bad("Something went wrong saving that.", 500);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  try {
    return Response.json({ ok: true, draft: await getDraft() });
  } catch (e) {
    return failed(e);
  }
}

/**
 * Make sure there is a draft, and return it.
 *
 * Idempotent, because the button that calls this is one somebody will
 * double-click: an existing draft comes back untouched rather than being
 * overwritten with a fresh copy of an older document. `restart: true` is the
 * explicit way to throw the edits away and copy the uploaded resume again, and
 * it is a different request precisely so it cannot happen by accident.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  let restart = false;
  let template: unknown;
  try {
    const body = (await request.json()) as { restart?: boolean; template?: unknown } | null;
    restart = body?.restart === true;
    template = body?.template;
  } catch {
    // No body is the ordinary case: "give me my draft, make one if you must."
  }

  try {
    // A named template is a request for a new resume in it, not a re-skin of
    // the one they have — see createFromTemplate for why those are different.
    if (isTemplateId(template)) {
      return Response.json({ ok: true, draft: await createFromTemplate(user.id, template) });
    }
    const draft = restart ? await reseedDraft(user.id) : await getOrCreateDraft(user.id);
    return Response.json({ ok: true, draft });
  } catch (e) {
    return failed(e);
  }
}

/**
 * Save what the editor sent.
 *
 * A whole document rather than a patch, because that is what an editor has:
 * every field on screen, as it stands. `patch` is the agent's shape, and it
 * goes through the same store either way.
 */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  let body: {
    id?: string;
    title?: string;
    content?: unknown;
    patch?: unknown;
    template?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return bad("Could not read that request.");
  }

  try {
    if (body.patch) {
      const draft = await patchDraft(user.id, cleanResume(body.patch));
      return Response.json({ ok: true, draft, score: draft.ats_score, result: draft.ats_result });
    }

    if (!body.id) return bad("No draft named.");

    /**
     * Everything that is not the document.
     *
     * The template is validated against the registry rather than stored as
     * sent, so a stale client — or somebody curling this — cannot leave a
     * draft pointing at a theme that does not exist. An unrecognised value is
     * dropped and the draft keeps the template it had, which is quieter than
     * a 400 for a field nobody deliberately set.
     */
    const extra = {
      ...(typeof body.title === "string" && body.title.trim()
        ? { title: body.title.trim().slice(0, 120) }
        : {}),
      ...(isTemplateId(body.template) ? { template: body.template } : {}),
    };

    const draft = await save(user.id, body.id, cleanResume(body.content), extra);
    return Response.json({ ok: true, draft, score: draft.ats_score, result: draft.ats_result });
  } catch (e) {
    return failed(e);
  }
}
