import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAppAdminClient } from "@/lib/supabase/app";

export const dynamic = "force-dynamic";

/**
 * Write, edit, publish and unpublish Insights.
 *
 *   { action: "save", id?, title, summary, category, imageUrl?, sourceName?, sourceUrl?, published }
 *   { action: "publish", id, published }
 *   { action: "delete", id }            owner only
 *
 * Anybody with the Insights section can do the first two. Deleting is kept
 * for the owner, the same rule as articles: an editor can take something down
 * (unpublish) but cannot make it as if it never existed.
 */
const MAX_WORDS = 70;

const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

type Body = {
  action?: string;
  id?: string;
  title?: string;
  summary?: string;
  category?: string;
  imageUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  published?: boolean;
};

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const httpUrl = (s: string) => /^https:\/\/[^\s]+$/i.test(s);

export async function POST(request: Request) {
  const guard = await requireAdmin("insights");
  if (!guard.ok) return guard.response;
  const { session } = guard;

  const db = createAppAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Could not read that request.");
  }

  if (body.action === "publish") {
    if (!body.id) return bad("Which insight?");
    const { error } = await db
      .from("insights")
      .update({ is_published: Boolean(body.published), updated_at: new Date().toISOString() })
      .eq("id", body.id);
    return error ? bad(error.message, 500) : Response.json({ ok: true });
  }

  if (body.action === "delete") {
    if (session.role !== "owner") return bad("Only the owner can delete. Unpublish it instead.", 403);
    if (!body.id) return bad("Which insight?");
    const { error } = await db.from("insights").delete().eq("id", body.id);
    return error ? bad(error.message, 500) : Response.json({ ok: true });
  }

  if (body.action !== "save") return bad("Unknown action.");

  // ------------------------------------------------------------- validate
  const title = (body.title ?? "").replace(/\s+/g, " ").trim();
  const summary = (body.summary ?? "").replace(/[ \t]+/g, " ").trim();
  const imageUrl = (body.imageUrl ?? "").trim();
  const sourceName = (body.sourceName ?? "").trim();
  const sourceUrl = (body.sourceUrl ?? "").trim();

  if (title.length < 5) return bad("Add a title — at least a few words.");
  if (title.length > 160) return bad("Keep the title under 160 characters.");
  if (words(summary) < 10 || summary.length < 40) return bad("The description needs at least 10 words.");
  if (words(summary) > MAX_WORDS) {
    return bad(`The description is ${words(summary)} words. Insights are ${MAX_WORDS} words at most.`);
  }
  if (summary.length > 700) return bad("The description is too long.");
  if (body.category !== "trend" && body.category !== "guide") return bad("Pick Trend or Guide.");
  if (imageUrl && !httpUrl(imageUrl)) return bad("The image link must start with https://");
  if (sourceUrl && !httpUrl(sourceUrl)) return bad("The source link must start with https://");

  // Who wrote it, by name, so the list can say so.
  let authorName = "Owner";
  if (session.role !== "owner") {
    authorName = "Team member";
    const site = createAdminClient();
    if (site && session.uid) {
      const { data } = await site
        .from("admin_users")
        .select("name, username")
        .eq("id", session.uid)
        .maybeSingle();
      const row = data as { name: string | null; username: string } | null;
      if (row) authorName = row.name?.trim() || row.username;
    }
  }

  const fields = {
    title,
    summary,
    category: body.category,
    image_url: imageUrl || null,
    source_name: sourceName || (sourceUrl ? hostOf(sourceUrl) : null),
    source_url: sourceUrl || null,
    is_published: body.published !== false,
    updated_at: new Date().toISOString(),
  };

  if (body.id) {
    const { error } = await db.from("insights").update(fields).eq("id", body.id);
    if (error) return bad(error.message, 500);
    return Response.json({ ok: true, id: body.id });
  }

  const { data, error } = await db
    .from("insights")
    .insert({
      ...fields,
      author_id: session.role === "owner" ? "owner" : session.uid,
      author_name: authorName,
    })
    .select("id")
    .single();

  if (error) {
    if (/duplicate/i.test(error.message)) return bad("An insight with that source link already exists.");
    if (/does not exist|schema cache|column/i.test(error.message)) {
      return bad("Insights aren't set up yet — run supabase/schemas/90_insights.sql.", 503);
    }
    return bad(error.message, 500);
  }
  return Response.json({ ok: true, id: (data as { id: string }).id });
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
