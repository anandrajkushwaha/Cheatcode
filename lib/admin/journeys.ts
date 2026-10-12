import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
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

  let vq = db
    .from("page_views")
    .select(
      "path,session_id,source,medium,campaign,city,os,browser,device,created_at",
    )
    .eq("is_bot", false)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(ROW_LIMIT);
  if (until) vq = vq.lte("created_at", until);

  let eq = db
    .from("page_events")
    .select("event,path,label,value,params,session_id,created_at")
    .eq("is_bot", false)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(ROW_LIMIT);
  if (until) eq = eq.lte("created_at", until);

  const [v, e] = await Promise.all([vq, eq]);
  if (v.error) return { ok: false, error: v.error.message };
  if (e.error) return { ok: false, error: e.error.message };
  const views = (v.data ?? []) as View[];
  const events = (e.data ?? []) as Event[];
  const truncated = views.length >= ROW_LIMIT || events.length >= ROW_LIMIT;
  return { ok: true, data: buildJourneys(views, events, filter, truncated) };
}
