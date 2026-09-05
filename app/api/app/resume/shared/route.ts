import { getSessionUser } from "@/lib/supabase/app";
import { cleanResume } from "@/lib/app/resume-schema";
import { saveShared, StoreError } from "@/lib/app/resume-store";

/**
 * A save from somebody who was given a pen but does not own the document.
 *
 * The route deliberately knows almost nothing. It has a share id and a
 * session; it does not decide whether that session may write, and it cannot —
 * `saveShared` looks the grant up itself and refuses. Anything the browser
 * claims about who it is or what it may do is ignored, because the browser is
 * exactly the thing an attacker controls.
 *
 * There is no draft id in the request either. Taking one would let a
 * collaborator on resume A name resume B and have the check pass against the
 * wrong row; the share id is the only handle they are given, and the row it
 * resolves to is the only row that can be written.
 */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json(
      { ok: false, error: "Sign in to edit this resume." },
      { status: 401 },
    );
  }

  let body: { shareId?: string; content?: unknown; styles?: unknown; photo?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that request." }, { status: 400 });
  }

  if (!body.shareId) {
    return Response.json({ ok: false, error: "No resume named." }, { status: 400 });
  }

  try {
    await saveShared(body.shareId, user.email ?? null, cleanResume(body.content), {
      styles: body.styles,
      photo: typeof body.photo === "string" || body.photo === null ? body.photo : undefined,
    });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof StoreError) {
      return Response.json({ ok: false, error: e.message }, { status: e.status });
    }
    console.error("resume/shared:", e);
    return Response.json({ ok: false, error: "That didn't save." }, { status: 500 });
  }
}
