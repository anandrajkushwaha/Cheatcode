import { createAdminClient } from "@/lib/supabase/admin";
import { requireIngestSecret } from "@/lib/ingest/auth";

export const dynamic = "force-dynamic";

/**
 * Claims the next keyword for a slot and returns the brief.
 * Called by the scheduled writing session at the start of each run.
 */
export async function GET(request: Request) {
  const denied = requireIngestSecret(request);
  if (denied) return denied;

  const db = createAdminClient();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const slotParam = url.searchParams.get("slot");
  const slot = slotParam ? Number(slotParam) : null;

  const { data, error } = await db.rpc("claim_next_keyword", {
    p_slot: Number.isInteger(slot) ? slot : null,
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: true, empty: true, message: "Queue is empty." });
  }

  const { data: existing } = await db
    .from("posts")
    .select("slug,title,focus_keyword,category:categories(slug)")
    .order("published_at", { ascending: false })
    .limit(60);

  return Response.json({
    ok: true,
    empty: false,
    keyword: data,
    // So the writer can link internally to real, existing articles.
    existingPosts: (existing ?? []).map((p) => ({
      slug: p.slug,
      title: p.title,
      focus_keyword: p.focus_keyword,
    })),
  });
}
