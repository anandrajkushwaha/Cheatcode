import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireIngestSecret } from "@/lib/ingest/auth";
import { runQualityGate, type Draft } from "@/lib/ingest/quality";

export const dynamic = "force-dynamic";

/**
 * Receives one finished article from a scheduled writing session.
 * Validates it, publishes it, closes the queue row, and purges the cache.
 * Nothing that fails the gate is ever published.
 */
export async function POST(request: Request) {
  const denied = requireIngestSecret(request);
  if (denied) return denied;

  const started = Date.now();

  const db = createAdminClient();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase not configured" }, { status: 503 });
  }

  let payload: { draft?: Draft; queueId?: number; slot?: number };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const draft = payload.draft;
  const queueId = payload.queueId ?? null;
  const slot = payload.slot ?? null;

  if (!draft?.slug || !draft.content_html || !draft.focus_keyword) {
    return Response.json({ ok: false, error: "Missing required draft fields" }, { status: 400 });
  }

  const log = async (ok: boolean, reason: string, postId: string | null, words: number) => {
    await db.from("publish_log").insert({
      queue_id: queueId,
      post_id: postId,
      slot,
      ok,
      reason: reason.slice(0, 900),
      word_count: words,
      duration_ms: Date.now() - started,
    });
  };

  // Known slugs, so the gate can reject links to articles that don't exist.
  const { data: existing } = await db.from("posts").select("slug").limit(5000);
  const knownSlugs = new Set((existing ?? []).map((p) => p.slug as string));

  const gate = runQualityGate(draft, knownSlugs);

  if (!gate.pass) {
    const reason = gate.reasons.join("; ");
    if (queueId) {
      const { data: row } = await db
        .from("keyword_queue")
        .select("attempts")
        .eq("id", queueId)
        .maybeSingle();
      const attempts = (row?.attempts as number) ?? 1;
      // Three strikes, then stop retrying so the queue can't jam on one keyword.
      await db
        .from("keyword_queue")
        .update({ status: attempts >= 3 ? "failed" : "pending", last_error: reason.slice(0, 500) })
        .eq("id", queueId);
    }
    await log(false, reason, null, gate.metrics.words);
    return Response.json({ ok: false, rejected: true, reasons: gate.reasons }, { status: 422 });
  }

  const { data: cat } = await db
    .from("categories")
    .select("id")
    .eq("slug", draft.category_slug)
    .maybeSingle();
  const { data: author } = await db
    .from("authors")
    .select("id")
    .eq("slug", "cheatcode-team")
    .maybeSingle();

  const m = gate.metrics;
  const now = new Date().toISOString();

  const { data: inserted, error } = await db
    .from("posts")
    .insert({
      slug: draft.slug,
      post_type: draft.post_type ?? "editorial",
      status: "published",
      title: draft.title,
      h1: draft.h1 ?? draft.title,
      excerpt: draft.excerpt,
      content_html: m.html,
      toc: m.toc,
      published_at: now,
      updated_at: now,
      category_id: cat?.id ?? null,
      author_id: author?.id ?? null,
      seo_title: draft.seo_title,
      seo_description: draft.seo_description,
      focus_keyword: draft.focus_keyword,
      secondary_keywords: draft.secondary_keywords ?? [],
      faq: draft.faq ?? [],
      entity_type: draft.entity_type ?? null,
      entity_slug: draft.entity_slug ?? null,
      entity_name: draft.entity_name ?? null,
      related_tool_slugs: m.internal.some((l) => l.startsWith("/tools/"))
        ? ["in-hand-salary-calculator"]
        : [],
      internal_links: m.internal,
      word_count: m.words,
      data_points: m.dataPoints,
      quality_score: gate.score,
      reading_minutes: Math.max(1, Math.round(m.words / 220)),
    })
    .select("id")
    .single();

  if (error) {
    await log(false, `insert failed: ${error.message}`, null, m.words);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (queueId) {
    await db
      .from("keyword_queue")
      .update({ status: "done", post_id: inserted.id, last_error: null })
      .eq("id", queueId);
  }

  await log(true, `published /blog/${draft.slug}`, inserted.id, m.words);

  // Purge only what changed.
  revalidatePath("/blog");
  revalidatePath(`/blog/${draft.slug}`);
  if (draft.category_slug) revalidatePath(`/blog/category/${draft.category_slug}`);
  revalidatePath("/sitemap/posts.xml");
  revalidatePath("/rss.xml");

  return Response.json({
    ok: true,
    url: `/blog/${draft.slug}`,
    words: m.words,
    score: gate.score,
  });
}
