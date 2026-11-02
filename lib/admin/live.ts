import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDataCentre } from "@/lib/admin/journeys-build";

/**
 * Who is on the site right now: visits with a page view or an event in the
 * last few minutes. The same visits Journeys counts — bots and data-centre
 * crawlers out, and our own browsers were never recorded (cc_owner).
 *
 * "Right now" is a window, not a socket: the tracker sends a page view on
 * every navigation and events as people scroll and click, so somebody
 * reading one long article quietly drops out after five minutes. Good enough
 * to answer "is anyone here, and which visits are they".
 */

export const LIVE_MINUTES = 5;

export async function getLive(): Promise<{ ok: true; count: number; sessions: string[] } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Supabase isn't configured." };
  const since = new Date(Date.now() - LIVE_MINUTES * 60_000).toISOString();

  const [v, e] = await Promise.all([
    db.from("page_views").select("session_id,city").eq("is_bot", false).gte("created_at", since).limit(5000),
    db.from("page_events").select("session_id,city").eq("is_bot", false).gte("created_at", since).limit(5000),
  ]);
  if (v.error) return { ok: false, error: v.error.message };
  if (e.error) return { ok: false, error: e.error.message };

  const live = new Set<string>();
  for (const r of [...(v.data ?? []), ...(e.data ?? [])] as { session_id: string | null; city: string | null }[]) {
    if (r.session_id && !isDataCentre(r.city)) live.add(r.session_id);
  }
  return { ok: true, count: live.size, sessions: [...live] };
}
