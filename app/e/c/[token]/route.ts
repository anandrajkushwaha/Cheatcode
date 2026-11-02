import { createAppAdminClient } from "@/lib/supabase/app";
import { SITE } from "@/lib/seo/constants";

export const dynamic = "force-dynamic";

/**
 * A click in an email: record it against the person, then send them on.
 * Only to a path on this site — never an open redirect — tagged with UTM so
 * Journeys shows the visit as coming from email.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = new URL(req.url);
  const asked = url.searchParams.get("to") ?? "/";
  const path = asked.startsWith("/") && !asked.startsWith("//") ? asked : "/";

  let campaign = "email";
  const db = createAppAdminClient();
  if (db && /^[a-z0-9]{16,64}$/i.test(token)) {
    const { data } = await db.from("email_sends").select("id,campaign,click_count,clicked_at,opened_at").eq("token", token).maybeSingle();
    const row = data as { id: string; campaign: string; click_count: number; clicked_at: string | null; opened_at: string | null } | null;
    if (row) {
      campaign = row.campaign;
      const now = new Date().toISOString();
      // A click proves the email was opened, even when the pixel was blocked.
      await db
        .from("email_sends")
        .update({ click_count: row.click_count + 1, clicked_at: row.clicked_at ?? now, opened_at: row.opened_at ?? now })
        .eq("id", row.id);
    }
  }

  const to = new URL(path, SITE.url);
  to.searchParams.set("utm_source", "email");
  to.searchParams.set("utm_medium", "email");
  to.searchParams.set("utm_campaign", campaign);
  return Response.redirect(to.toString(), 302);
}
