import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitiseHtml, slugify, textOf, wordCount } from "@/lib/content/sanitise";
import { withHeadingIds } from "@/lib/content/render";

export const dynamic = "force-dynamic";

type Body = {
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string;
  content_html?: string;
  category_id?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
  cover_image?: string | null;
  cover_alt?: string | null;
  /** "draft" keeps it out of the site entirely; "published" respects the date. */
  status?: "draft" | "published";
  published_at?: string;
};

const bad = (error: string, status = 400) =>
  Response.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) return bad("Not signed in", 401);

  const db = createAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return bad("Could not read that request.");
  }

  const title = (body.title ?? "").trim();
  if (!title) return bad("Give the article a title before saving.");

  const slug = slugify(body.slug || title);
  if (!slug) return bad("That title has no letters or numbers in it, so it has no address.");

  // The editor's HTML is never trusted. This is the only place it is cleaned,
  // and it runs on every save including an edit of an imported article.
  const html = sanitiseHtml(body.content_html ?? "");
  const words = wordCount(html);

  // The table of contents is derived, never authored — otherwise it drifts out
  // of step with the headings the moment anyone edits one.
  const rendered = withHeadingIds(html, []);
  const toc = [...rendered.matchAll(/<h2[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => ({
    id: m[1],
    text: textOf(m[2]),
  }));

  const excerpt = (body.excerpt ?? "").trim() || textOf(html).slice(0, 180);
  const status = body.status === "draft" ? "draft" : "published";

  const publishedAt = body.published_at ? new Date(body.published_at) : new Date();
  if (Number.isNaN(publishedAt.getTime())) return bad("That publish date isn't a real date.");

  // A slug is an address. Letting two rows fight over one silently overwrites
  // an article, so check before writing rather than relying on the constraint.
  const { data: clash } = await db.from("posts").select("id,slug").eq("slug", slug).limit(1);
  const existing = (clash ?? [])[0] as { id: string } | undefined;
  if (existing && body.id && existing.id !== body.id) {
    return bad(`Another article already lives at /blog/${slug}. Change the address.`);
  }
  if (existing && !body.id) {
    return bad(`An article already lives at /blog/${slug}. Open it to edit instead.`);
  }

  const row = {
    slug,
    title,
    h1: title,
    excerpt,
    content_html: html,
    toc,
    category_id: body.category_id || null,
    seo_title: (body.seo_title ?? "").trim() || title.slice(0, 62),
    seo_description: (body.seo_description ?? "").trim() || excerpt.slice(0, 158),
    focus_keyword: (body.focus_keyword ?? "").trim() || null,
    cover_image: (body.cover_image ?? "").trim() || null,
    cover_alt: (body.cover_alt ?? "").trim() || null,
    status,
    published_at: publishedAt.toISOString(),
    updated_at: new Date().toISOString(),
    last_edited_at: new Date().toISOString(),
    word_count: words,
    reading_minutes: Math.max(1, Math.round(words / 210)),
    // Marks this row as yours, so a content re-sync never overwrites it.
    origin: "editor",
    post_type: "editorial",
  };

  const result = body.id
    ? await db.from("posts").update(row).eq("id", body.id).select("id,slug").limit(1)
    : await db.from("posts").insert(row).select("id,slug").limit(1);

  if (result.error) return Response.json({ ok: false, error: result.error.message }, { status: 500 });

  // The blog is statically cached; without this the new article is invisible
  // until the next revalidation window closes.
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/rss.xml");

  const saved = (result.data ?? [])[0] as { id: string; slug: string } | undefined;
  return Response.json({
    ok: true,
    id: saved?.id ?? body.id ?? null,
    slug,
    words,
    scheduled: publishedAt > new Date(),
  });
}

export async function DELETE(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) return bad("Not signed in", 401);

  const db = createAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return bad("No article named.");

  const { data } = await db.from("posts").select("slug,origin").eq("id", id).limit(1);
  const post = (data ?? [])[0] as { slug: string; origin: string } | undefined;
  if (!post) return bad("That article no longer exists.", 404);

  // An imported row would simply come back on the next re-sync, so deleting it
  // here would look like a bug rather than a no-op.
  if (post.origin !== "editor") {
    return bad(
      "This article came from the deployment's content files, so deleting it here would only " +
        "last until the next re-sync. Remove it from articles.json instead.",
    );
  }

  const { error } = await db.from("posts").delete().eq("id", id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/sitemap.xml");
  return Response.json({ ok: true });
}
