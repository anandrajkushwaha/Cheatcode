import { requireAdmin } from "@/lib/admin/guard";
import { markReview } from "@/lib/app/resume-review";

export const dynamic = "force-dynamic";

/** Mark a review handled, or leave a note for the next reviewer. */
export async function POST(request: Request) {
  const guard = await requireAdmin("resumes");
  if (!guard.ok) return guard.response;

  let body: { id?: string; status?: string; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that." }, { status: 400 });
  }

  if (!body.id) return Response.json({ ok: false, error: "Which one?" }, { status: 400 });

  const allowed = new Set(["open", "done", "cancelled"]);
  if (body.status && !allowed.has(body.status)) {
    return Response.json({ ok: false, error: "Unknown status." }, { status: 400 });
  }

  const ok = await markReview(body.id, { status: body.status, adminNote: body.adminNote });
  if (!ok) return Response.json({ ok: false, error: "Could not update." }, { status: 502 });

  return Response.json({ ok: true });
}
