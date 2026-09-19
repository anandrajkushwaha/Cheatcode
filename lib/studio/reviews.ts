import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * The testimonials on the Pro page.
 *
 * Shape is shared with the admin screen so the preview there and the card on
 * the landing page cannot drift — one type, one component, two callers.
 */

export type Review = {
  id: number;
  name: string;
  role: string;
  quote: string;
  avatarUrl: string | null;
  position: number;
  published: boolean;
};

type Row = {
  id: number;
  name: string | null;
  role: string | null;
  quote: string | null;
  avatar_url: string | null;
  position: number | null;
  published: boolean | null;
};

export function toReview(row: Row): Review {
  return {
    id: row.id,
    name: row.name?.trim() || "Someone",
    role: row.role?.trim() || "",
    quote: row.quote?.trim() || "",
    avatarUrl: row.avatar_url?.trim() || null,
    position: row.position ?? 0,
    published: row.published ?? false,
  };
}

/**
 * Published reviews, in the order the admin put them in.
 *
 * Returns an empty array on every failure — a missing table, a bad key, a
 * network blip. A landing page that 500s because a testimonial query failed
 * is a worse outcome than a landing page with no testimonials, and the
 * section hides itself when the list is empty.
 */
export async function getReviews(): Promise<Review[]> {
  const db = createAppAdminClient();
  if (!db) return [];

  const { data, error } = await db
    .from("reviews")
    .select("id, name, role, quote, avatar_url, position, published")
    .eq("published", true)
    .order("position", { ascending: true })
    .order("id", { ascending: true })
    .limit(24);

  if (error) {
    console.error("[reviews] read failed", error.message);
    return [];
  }

  return ((data ?? []) as Row[]).map(toReview);
}

/** Everything, drafts included. Admin only — never call this from a page. */
export async function getAllReviews(): Promise<
  { ok: true; data: Review[] } | { ok: false; missing: string }
> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "73_reviews.sql" };

  const { data, error } = await db
    .from("reviews")
    .select("id, name, role, quote, avatar_url, position, published")
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("[reviews] admin read failed", error.message);
    return { ok: false, missing: "73_reviews.sql" };
  }

  return { ok: true, data: ((data ?? []) as Row[]).map(toReview) };
}
