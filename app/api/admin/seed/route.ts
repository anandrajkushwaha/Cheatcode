import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

import categories from "@/content/seed/categories.json";
import authors from "@/content/seed/authors.json";
import keywords from "@/content/seed/keywords.json";
import articles from "@/content/launch/articles.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POSTS_BATCH = 8;

type Article = (typeof articles)[number];

/**
 * Seeds the database from the JSON bundled with the deployment.
 *
 * Runs in steps so no single request gets close to the function timeout.
 * The client calls it repeatedly, passing back the `next` value it received.
 * Every step is an upsert, so re-running is safe and never duplicates.
 */
export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) {
    return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const db = createAdminClient();
  if (!db) {
    return Response.json(
      { ok: false, error: "SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_URL is missing." },
      { status: 503 },
    );
  }

  let step = "taxonomy";
  try {
    const body = await request.json();
    if (typeof body?.step === "string") step = body.step;
  } catch {
    /* first call may have no body */
  }

  // ---------- step 1: categories + authors ----------
  if (step === "taxonomy") {
    const a = await db.from("categories").upsert(categories, { onConflict: "slug" });
    if (a.error) return fail(a.error.message);
    const b = await db.from("authors").upsert(authors, { onConflict: "slug" });
    if (b.error) return fail(b.error.message);

    return Response.json({
      ok: true,
      done: false,
      next: "keywords",
      message: `${categories.length} topics and ${authors.length} author added`,
      progress: 5,
    });
  }

  // ---------- step 2: the keyword queue ----------
  if (step === "keywords") {
    for (let i = 0; i < keywords.length; i += 60) {
      const r = await db
        .from("keyword_queue")
        .upsert(keywords.slice(i, i + 60), { onConflict: "focus_keyword" });
      if (r.error) return fail(r.error.message);
    }
    return Response.json({
      ok: true,
      done: false,
      next: "posts:0",
      message: `${keywords.length} keywords queued`,
      progress: 15,
    });
  }

  // ---------- step 3: the launch articles, in batches ----------
  if (step.startsWith("posts:")) {
    const start = Number(step.split(":")[1]) || 0;
    const slice = (articles as Article[]).slice(start, start + POSTS_BATCH);

    if (slice.length === 0) {
      return Response.json({ ok: true, done: false, next: "finalize", progress: 90 });
    }

    const [{ data: cats }, { data: auths }] = await Promise.all([
      db.from("categories").select("id,slug"),
      db.from("authors").select("id,slug"),
    ]);
    const catId = Object.fromEntries((cats ?? []).map((c) => [c.slug, c.id]));
    const authorId =
      (auths ?? []).find((a) => a.slug === "cheatcode-team")?.id ?? (auths ?? [])[0]?.id ?? null;

    const rows = slice.map((a) => ({
      slug: a.slug,
      post_type: a.post_type,
      status: "published",
      title: a.title,
      h1: a.h1 ?? a.title,
      excerpt: a.excerpt,
      content_html: a.content_html,
      toc: a.toc,
      published_at: a.published_at,
      updated_at: a.published_at,
      category_id: catId[a.category_slug] ?? null,
      author_id: authorId,
      seo_title: a.seo_title,
      seo_description: a.seo_description,
      focus_keyword: a.focus_keyword,
      secondary_keywords: a.secondary_keywords ?? [],
      faq: a.faq ?? [],
      entity_type: a.entity_type ?? null,
      entity_slug: a.entity_slug ?? null,
      entity_name: a.entity_name ?? null,
      related_tool_slugs: a.related_tool_slugs ?? [],
      internal_links: a.internal_links ?? [],
      word_count: a.word_count,
      data_points: a.data_points,
      quality_score: a.quality_score,
      reading_minutes: a.reading_minutes,
    }));

    const r = await db.from("posts").upsert(rows, { onConflict: "slug" });
    if (r.error) return fail(r.error.message);

    const next = start + POSTS_BATCH;
    const total = (articles as Article[]).length;
    return Response.json({
      ok: true,
      done: false,
      next: next >= total ? "finalize" : `posts:${next}`,
      message: `${Math.min(next, total)} of ${total} articles loaded`,
      progress: 15 + Math.round((Math.min(next, total) / total) * 75),
    });
  }

  // ---------- step 4: close the queue rows those articles used, purge cache ----------
  if (step === "finalize") {
    const { data: posts } = await db.from("posts").select("id,focus_keyword");
    for (const p of posts ?? []) {
      await db
        .from("keyword_queue")
        .update({ status: "done", post_id: p.id })
        .eq("focus_keyword", p.focus_keyword);
    }

    revalidatePath("/blog");
    revalidatePath("/rss.xml");
    revalidatePath("/sitemap/posts.xml");
    revalidatePath("/sitemap/categories.xml");
    for (const c of categories) revalidatePath(`/blog/category/${c.slug}`);
    for (const a of articles as Article[]) revalidatePath(`/blog/${a.slug}`);

    const { count } = await db.from("posts").select("id", { count: "exact", head: true });
    const { count: pending } = await db
      .from("keyword_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return Response.json({
      ok: true,
      done: true,
      progress: 100,
      message: `Done — ${count ?? 0} articles live, ${pending ?? 0} keywords still queued.`,
    });
  }

  return Response.json({ ok: false, error: `Unknown step: ${step}` }, { status: 400 });
}

function fail(message: string) {
  return Response.json({ ok: false, error: message }, { status: 500 });
}
