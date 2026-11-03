import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/admin/fetch-all";
import type { Range } from "@/lib/admin/range";
import {
  buildJourneys,
  type Event,
  type JourneysReport,
  type SourceFilter,
  type View,
} from "@/lib/admin/journeys-build";

export {
  STEPS,
  type Breakdown,
  type SourceFilter,
} from "@/lib/admin/journeys-build";

/** Reads the period's analytics rows; the report itself is built in journeys-build.ts. */

const ROW_LIMIT = 50_000;
export async function getJourneys(
  range: Range,
  filter: SourceFilter,
): Promise<{ ok: true; data: JourneysReport } | { ok: false; error: string }> {
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Supabase isn't configured." };

  const since =
    range.from ?? new Date(Date.now() - range.days * 86_400_000).toISOString();
  const until = range.to ?? null;

  const viewsPage = (from: number, to: number) => {
    let q = db
      .from("page_views")
      .select("path,session_id,source,medium,campaign,country,city,os,browser,device,created_at")
      .eq("is_bot", false)
      .gte("created_at", since);
    if (until) q = q.lte("created_at", until);
    // id breaks ties between rows with the same timestamp, so pages never overlap.
    return q.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to);
  };
  const eventsPage = (from: number, to: number) => {
    let q = db
      .from("page_events")
      .select("event,path,label,value,params,session_id,created_at")
      .eq("is_bot", false)
      .neq("event", "heartbeat")
      .gte("created_at", since);
    if (until) q = q.lte("created_at", until);
    return q.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to);
  };

  const [v, e] = await Promise.all([fetchAll<View>(viewsPage, ROW_LIMIT), fetchAll<Event>(eventsPage, ROW_LIMIT)]);
  if (v.error) return { ok: false, error: v.error };
  if (e.error) return { ok: false, error: e.error };
  const views = v.rows;
  const events = e.rows;
  const truncated = views.length >= ROW_LIMIT || events.length >= ROW_LIMIT;
  return { ok: true, data: buildJourneys(views, events, filter, truncated) };
}
