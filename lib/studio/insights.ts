import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import type { Insight } from "@/components/studio/InsightsPanel";

/**
 * What fills the Insights panel.
 *
 * Reads the table the ingest run writes. The admin client is used rather than
 * the user's own because these rows are identical for everybody — there is no
 * per-user filtering to do, and going through RLS here would mean the panel
 * silently empties for anyone whose session is a moment stale.
 *
 * Failures return an empty list rather than throwing. The panel is context
 * beside the conversation, and a feed problem should never be the reason
 * somebody cannot reach the thing they came to use.
 */

type Row = {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  source_name: string;
  published_at: string | null;
};

/**
 * One timezone, fixed.
 *
 * The audience is in India and the server is not, so formatting with the
 * machine's own zone would put yesterday's date on this morning's story. It
 * also has to be done here rather than in the component: the panel renders on
 * both the server and the client, and a date formatted twice in two zones is
 * a hydration mismatch.
 */
const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

function label(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return DATE_FORMAT.format(date);
}

function toInsight(row: Row): Insight {
  return {
    id: row.id,
    kind: row.kind === "guide" || row.kind === "tip" ? row.kind : "trend",
    title: row.title,
    summary: row.summary ?? "",
    url: row.url,
    imageUrl: row.image_url,
    source: row.source_name,
    publishedAt: row.published_at,
    publishedLabel: label(row.published_at),
  };
}

const COLUMNS = "id, kind, title, summary, url, image_url, source_name, published_at";

export async function getInsights(limit = 24): Promise<Insight[]> {
  const db = createAppAdminClient();
  if (!db) return [];

  const { data, error } = await db
    .from("insights")
    .select(COLUMNS)
    .eq("is_active", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("first_seen_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Row[]).map(toInsight);
}

/** One item, for its own page. Null when it does not exist or is retired. */
export async function getInsight(id: string): Promise<Insight | null> {
  const db = createAppAdminClient();
  if (!db) return null;

  const { data, error } = await db
    .from("insights")
    .select(COLUMNS)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return toInsight(data as Row);
}
