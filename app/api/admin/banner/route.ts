import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PLACEMENTS = new Set(["in_article", "sidebar", "blog_list"]);
const bad = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

/** Same rule as the article sanitiser: no javascript:, no data:. */
function safeHref(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  return /^(https?:\/\/|\/|#|mailto:)/i.test(s) && !/^javascript:/i.test(s) ? s : null;
}

export async function POST(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) return bad("Not signed in", 401);

  const db = createAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return bad("Could not read that request.");
  }

  const title = String(b.title ?? "").trim();
  if (!title) return bad("The banner needs a headline — that is the part people read.");

  const placement = String(b.placement ?? "");
  if (!PLACEMENTS.has(placement)) return bad("Choose where the banner should appear.");

  const ctaHref = safeHref(b.cta_href as string);
  if (b.cta_href && !ctaHref) {
    return bad("That link isn't valid. Use /become-a-mentor for your own pages, or a full https:// address.");
  }
  if (ctaHref && !String(b.cta_label ?? "").trim()) {
    return bad("A link with no button text has nothing to click.");
  }

  const row = {
    name: String(b.name ?? "").trim() || title.slice(0, 60),
    placement,
    eyebrow: String(b.eyebrow ?? "").trim() || null,
    title,
    body: String(b.body ?? "").trim() || null,
    cta_label: String(b.cta_label ?? "").trim() || null,
    cta_href: ctaHref,
    image_url: safeHref(b.image_url as string),
    image_alt: String(b.image_alt ?? "").trim() || null,
    theme: b.theme === "light" ? "light" : "dark",
    active: b.active !== false,
    starts_at: b.starts_at ? new Date(String(b.starts_at)).toISOString() : null,
    ends_at: b.ends_at ? new Date(String(b.ends_at)).toISOString() : null,
    sort_order: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0,
    updated_at: new Date().toISOString(),
  };

  const id = b.id ? String(b.id) : null;
  const result = id
    ? await db.from("promo_banners").update(row).eq("id", id).select("id").limit(1)
    : await db.from("promo_banners").insert(row).select("id").limit(1);

  if (result.error) return Response.json({ ok: false, error: result.error.message }, { status: 500 });

  // Banners render inside cached pages, so they will not appear until the
  // cache is cleared — which looks exactly like the banner not working.
  revalidatePath("/blog");
  revalidatePath("/blog/[slug]", "page");

  return Response.json({ ok: true, id: (result.data ?? [])[0]?.id ?? id });
}

export async function DELETE(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) return bad("Not signed in", 401);

  const db = createAdminClient();
  if (!db) return bad("Supabase isn't configured on this deployment.", 503);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return bad("No banner named.");

  const { error } = await db.from("promo_banners").delete().eq("id", id);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  revalidatePath("/blog");
  revalidatePath("/blog/[slug]", "page");
  return Response.json({ ok: true });
}
