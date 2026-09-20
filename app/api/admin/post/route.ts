import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
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
  const guard = await requireAdmin("articles");
  if (!guard.ok) return guard.response;

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

  /**
   * Who did this.
   *
   * `last_edited_by` on every save; `created_by` only on the insert, because
   * "who wrote this" is not supposed to change when somebody else fixes a
   * typo in it. Both are null for the owner — that account has no row in
   * admin_users to point at, and the team screen reads a null as "you".
   */
  const actor = guard.session.role === "owner" ? null : guard.session.uid || null;

  const write = (withAuthor: boolean) => {
    const payload = withAuthor
      ? body.id
        ? { ...row, last_edited_by: actor }
        : { ...row, created_by: actor, last_edited_by: actor }
      : row;

    return body.id
      ? db.from("posts").update(payload).eq("id", body.id).select("id,slug").limit(1)
      : db.from("posts").insert(payload).select("id,slug").limit(1);
  };

  let result = await write(true);

  /**
   * Save the article even if the authorship columns are not there yet.
   *
   * created_by and last_edited_by arrive in 86_post_authorship.sql. On a
   * database where that has not been run, sending them turned every save into
   * a 500 — which meant a schema migration nobody had got round to could stop
   * the team publishing. Losing the byline is an acceptable failure; losing
   * the article is not, so the write is retried without them and the reason
   * is logged rather than shown.
   */
  if (result.error && /created_by|last_edited_by/.test(result.error.message)) {
    console.error(
      "[post] authorship columns missing — run supabase/schemas/86_post_authorship.sql",
      result.error.message,
    );
    result = await write(false);
  }

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
  // Owner only, deliberately. "Publish articles" is a different permission
  // from "remove a published article", and an editor account exists to add to
  // the site rather than to take things off it. If an editor needs something
  // gone they can unpublish it, which is reversible.
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

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
