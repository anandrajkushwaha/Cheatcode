import { getSessionUser } from "@/lib/supabase/app";
import {
  addCollaborator,
  listCollaborators,
  removeCollaborator,
  StoreError,
} from "@/lib/app/resume-store";

/**
 * The guest list for one resume.
 *
 * Separate from the share route on purpose. The link is one switch with one
 * blast radius; this is a list of named people, and each entry is a decision
 * the owner made about one human being. Mixing them into a single endpoint
 * would mean an "add this person" request and a "publish to the internet"
 * request travelling under the same name in the logs.
 *
 * Every path here re-reads the list from the database and returns it, so the
 * dialog never has to guess what the server did — the screen after an action
 * is the server's answer, not an optimistic edit to local state.
 */

async function respond(fn: () => Promise<{ id: string; email: string; role: string }[]>) {
  try {
    return Response.json({ ok: true, people: await fn() });
  } catch (e) {
    if (e instanceof StoreError) {
      return Response.json({ ok: false, error: e.message }, { status: e.status });
    }
    console.error("resume/people:", e);
    return Response.json({ ok: false, error: "That didn't work." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ ok: false, error: "No resume named." }, { status: 400 });

  return respond(() => listCollaborators(id));
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  let body: { id?: string; action?: string; email?: string; role?: string; personId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that request." }, { status: 400 });
  }

  const id = body.id;
  if (!id) return Response.json({ ok: false, error: "No resume named." }, { status: 400 });

  if (body.action === "remove") {
    if (!body.personId) {
      return Response.json({ ok: false, error: "No one named." }, { status: 400 });
    }
    return respond(() => removeCollaborator(user.id, id, body.personId as string));
  }

  if (!body.email) {
    return Response.json({ ok: false, error: "No email address." }, { status: 400 });
  }

  // Inviting somebody who is already on the list changes their role rather
  // than erroring, so "add" and "make them an editor" are the same request.
  return respond(() =>
    addCollaborator(user.id, id, body.email as string, body.role === "edit" ? "edit" : "view"),
  );
}
