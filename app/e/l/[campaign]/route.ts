import { createAppAdminClient } from "@/lib/supabase/app";
import { SITE } from "@/lib/seo/constants";

export const dynamic = "force-dynamic";

/**
 * The button in an email sent by hand: count the click for its campaign,
 * then send the reader on — only to a page on this site, never elsewhere —
 * tagged with UTM, so Journeys, Traffic and the ATS leads all record the
 * visit as coming from that email.
 */
export async function GET(req: Request, { params }: { params: Promise<{ campaign: string }> }) {
  const { campaign } = await params;
  const ok = /^[a-z0-9_-]{1,40}$/i.test(campaign);
  const asked = new URL(req.url).searchParams.get("to") ?? "/tools/resume-ats-checker";
  const path = asked.startsWith("/") && !asked.startsWith("//") ? asked : "/tools/resume-ats-checker";

  const db = createAppAdminClient();
  if (db && ok) {
    await db.from("email_campaign_events").insert({ campaign, kind: "click", ua: req.headers.get("user-agent")?.slice(0, 200) ?? null });
  }
  const to = new URL(path, SITE.url);
  to.searchParams.set("utm_source", "email");
  to.searchParams.set("utm_medium", "email");
  if (ok) to.searchParams.set("utm_campaign", campaign);
  return Response.redirect(to.toString(), 302);
}
