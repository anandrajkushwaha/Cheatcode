import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDataCentre } from "@/lib/admin/journeys-build";

/**
 * Who is on the site right now. A visit is live when its latest page view or
 * event is under three minutes old and is not the "tab hidden" signal: the
 * tracker sends that the moment the page is closed or switched away from,
 * and a heartbeat every minute while it stays visible (components/Analytics).
 * So leaving drops a visit at once; a visit that vanishes without a signal
 * drops out within three minutes. Bots and data-centre crawlers are left out
 * as in Journeys, and our own browsers were never recorded (cc_owner).
 */

export const LIVE_MINUTES = 3;

type Row = { session_id: string | null; city: string | null; created_at: string; params?: Record<string, unknown> | null };

export async function getLive(): Promise<{ ok: true; count: number; sessions: string[] } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Supabase isn't configured." };
  const since = new Date(Date.now() - LIVE_MINUTES * 60_000).toISOString();

  const [v, e] = await Promise.all([
    db.from("page_views").select("session_id,city,created_at").eq("is_bot", false).gte("created_at", since).limit(5000),
    db.from("page_events").select("session_id,city,created_at,params").eq("is_bot", false).gte("created_at", since).limit(5000),
  ]);
  if (v.error) return { ok: false, error: v.error.message };
  if (e.error) return { ok: false, error: e.error.message };

  // The latest signal per visit decides: hidden means gone.
  const latest = new Map<string, { at: string; hidden: boolean }>();
  for (const r of [...(v.data ?? []), ...(e.data ?? [])] as Row[]) {
    if (!r.session_id || isDataCentre(r.city)) continue;
    const prev = latest.get(r.session_id);
    if (!prev || r.created_at >= prev.at) {
      latest.set(r.session_id, { at: r.created_at, hidden: r.params?.hidden === true });
    }
  }
  const sessions = [...latest.entries()].filter(([, s]) => !s.hidden).map(([id]) => id);
  return { ok: true, count: sessions.length, sessions };
}
