import { getSessionUser } from "@/lib/supabase/app";
import { listCollaborators, setSharing, StoreError } from "@/lib/app/resume-store";

/**
 * Switch the public link on or off, and say what it grants.
 *
 * Its own route rather than another field on the draft save, because it is a
 * different kind of act: saving changes a private document, and this one puts
 * a person's name, phone number and employment history on an address anybody
 * holding it can open. Keeping it separate means it cannot happen as a side
 * effect of an autosave, and it reads as its own line in a log.
 *
 * `linkRole` is optional and only moves when it is actually sent, so switching
 * sharing off and on again can never quietly promote a view link to one that
 * lets strangers rewrite the document.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  let body: { id?: string; on?: boolean; linkRole?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that request." }, { status: 400 });
  }

  if (!body.id) {
    return Response.json({ ok: false, error: "No resume named." }, { status: 400 });
  }

  // Only two values mean anything. Anything else is dropped rather than
  // defaulted — a typo must not be able to widen access.
  const linkRole =
    body.linkRole === "edit" ? "edit" : body.linkRole === "view" ? "view" : undefined;

  try {
    const draft = await setSharing(user.id, body.id, body.on !== false, linkRole);
    return Response.json({
      ok: true,
      shareId: draft.share_id,
      isPublic: draft.is_public,
      linkRole: draft.link_role,
      people: await listCollaborators(draft.id),
    });
  } catch (e) {
    if (e instanceof StoreError) {
      return Response.json({ ok: false, error: e.message }, { status: e.status });
    }
    console.error("resume/share:", e);
    return Response.json({ ok: false, error: "That didn't work." }, { status: 500 });
  }
}
