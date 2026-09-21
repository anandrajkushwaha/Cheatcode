import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";

export type Insight = {
  id: string;
  title: string;
  summary: string;
  category: "trend" | "guide";
  sourceName: string | null;
  sourceUrl: string | null;
  /** Shown only inside the Insights reader, never on the home card. */
  imageUrl: string | null;
  /** The publisher's time if known, otherwise when it was posted. */
  at: string;
};

export type AdminInsight = Insight & {
  published: boolean;
  authorName: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  title: string;
  summary: string;
  category: "trend" | "guide";
  source_name: string | null;
  source_url: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
  is_published: boolean;
  author_name: string | null;
};

const COLS =
  "id, title, summary, category, source_name, source_url, image_url, published_at, created_at, is_published, author_name";

function toInsight(r: Row): Insight {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    category: r.category,
    sourceName: r.source_name,
    sourceUrl: r.source_url,
    imageUrl: r.image_url,
    at: r.published_at ?? r.created_at,
  };
}

const missing = (m: string) => /does not exist|schema cache|column/i.test(m);

/**
 * Newest first, published only. Read with the service key because the table
 * has no public policy; the pages that call this are behind the sign-in wall.
 * A missing table (90_insights.sql not run) is an empty feed, not an error.
 */
export async function getInsights(limit = 60): Promise<Insight[]> {
  const db = createAppAdminClient();
  if (!db) return [];

  const { data, error } = await db
    .from("insights")
    .select(COLS)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (!missing(error.message)) console.error("[insights] read failed", error.message);
    return [];
  }
  return ((data ?? []) as Row[]).map(toInsight);
}

/** Everything, drafts included, for the admin screen. */
export async function getAllInsights(): Promise<
  { ok: true; data: AdminInsight[] } | { ok: false; setup: boolean; error: string }
> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, setup: true, error: "Supabase isn't configured." };

  const { data, error } = await db
    .from("insights")
    .select(COLS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false, setup: missing(error.message), error: error.message };
  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((r) => ({
      ...toInsight(r),
      published: r.is_published,
      authorName: r.author_name,
      createdAt: r.created_at,
    })),
  };
}
