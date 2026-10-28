import { createAppAdminClient, getSessionUser } from "@/lib/supabase/app";

export const dynamic = "force-dynamic";

/**
 * One step of the match popup (116_match_popup_events.sql), for
 * /admin/match-popup. After a resume download the person is signed in; after
 * the free ATS check they may not be — then the row is keyed to the browser's
 * visitor id and carries the contact block the checker read from the resume.
 * Best effort: a failed write never gets in the way of the popup.
 */
const EVENTS = new Set(["shown", "closed", "unlock_click", "pass_click", "apply_click", "see_all_click", "pro_click"]);
const UUID = /^[0-9a-f-]{36}$/i;
const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export async function POST(request: Request) {
  const user = await getSessionUser();
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const event = typeof b.event === "string" && EVENTS.has(b.event) ? b.event : null;
  const source = b.source === "ats" ? "ats" : "resume";
  const visitor = str(b.visitor, 64);
  if (!event) return Response.json({ ok: false }, { status: 400 });
  if (!user && (source !== "ats" || !visitor)) return Response.json({ ok: false }, { status: 401 });

  // Only small, known values: counts, scores, a few job ids.
  const p = (b.props && typeof b.props === "object" ? b.props : {}) as Record<string, unknown>;
  const props: Record<string, unknown> = {};
  for (const k of ["count", "best", "score", "locked", "ms"]) if (typeof p[k] === "number" || typeof p[k] === "boolean") props[k] = p[k];
  if (Array.isArray(p.jobs)) props.jobs = p.jobs.filter((x) => typeof x === "string" && UUID.test(x)).slice(0, 5);

  const c = (b.contact && typeof b.contact === "object" ? b.contact : null) as Record<string, unknown> | null;
  const contact = c ? { name: str(c.name, 100), email: str(c.email, 120), phone: str(c.phone, 20) } : null;

  const db = createAppAdminClient();
  if (db) {
    await db.from("match_popup_events").insert({
      user_id: user?.id ?? null,
      source,
      visitor,
      contact: contact && (contact.name || contact.email || contact.phone) ? contact : null,
      event,
      job_id: typeof b.jobId === "string" && UUID.test(b.jobId) ? b.jobId : null,
      props,
    });
  }
  return Response.json({ ok: true });
}
