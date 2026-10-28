import { createAppAdminClient, getSessionUser } from "@/lib/supabase/app";

export const dynamic = "force-dynamic";

/**
 * One step of the match popup, recorded against the user
 * (116_match_popup_events.sql) for /admin/match-popup. Best effort: a failed
 * write never gets in the way of the popup.
 */
const EVENTS = new Set(["shown", "closed", "unlock_click", "pass_click", "apply_click", "see_all_click", "pro_click"]);
const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { event?: unknown; jobId?: unknown; props?: unknown };
  const event = typeof b.event === "string" && EVENTS.has(b.event) ? b.event : null;
  if (!event) return Response.json({ ok: false }, { status: 400 });

  // Only small, known values: counts, scores, a few job ids.
  const p = (b.props && typeof b.props === "object" ? b.props : {}) as Record<string, unknown>;
  const props: Record<string, unknown> = {};
  for (const k of ["count", "best", "score", "locked", "ms"]) if (typeof p[k] === "number" || typeof p[k] === "boolean") props[k] = p[k];
  if (Array.isArray(p.jobs)) props.jobs = p.jobs.filter((x) => typeof x === "string" && UUID.test(x)).slice(0, 5);

  const db = createAppAdminClient();
  if (db) {
    await db.from("match_popup_events").insert({
      user_id: user.id,
      event,
      job_id: typeof b.jobId === "string" && UUID.test(b.jobId) ? b.jobId : null,
      props,
    });
  }
  return Response.json({ ok: true });
}
