import { createAppServerClient, getSessionUser } from "@/lib/supabase/app";
import { STATUSES, type ApplicationStatus } from "@/lib/jobs/applications";

export const dynamic = "force-dynamic";

/** The tracker: move the status, keep a note. Row-level security keeps it to their own rows. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  let body: { status?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that request." }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status as ApplicationStatus)) {
      return Response.json({ ok: false, error: "Unknown status." }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (typeof body.notes === "string") patch.notes = body.notes.slice(0, 2000);

  const supabase = await createAppServerClient();
  if (!supabase) return Response.json({ ok: false, error: "Not configured." }, { status: 503 });
  const { error } = await supabase.from("job_applications").update(patch).eq("id", id);
  if (error) return Response.json({ ok: false, error: "Couldn't save that." }, { status: 500 });
  // The first time it is marked applied; moving back to "applied" later keeps that date.
  if (patch.status === "applied") {
    await supabase
      .from("job_applications")
      .update({ applied_at: new Date().toISOString() })
      .eq("id", id)
      .is("applied_at", null);
  }
  return Response.json({ ok: true });
}
