import { createAppAdminClient } from "@/lib/supabase/app";

export const dynamic = "force-dynamic";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/**
 * Open pixel for an email sent by hand, counted per campaign. Approximate:
 * Gmail loads images through its proxy and caches them, Apple Mail loads
 * them on delivery, and some clients block images. Clicks are the number
 * to trust.
 */
export async function GET(req: Request, { params }: { params: Promise<{ campaign: string }> }) {
  const { campaign } = await params;
  const db = createAppAdminClient();
  if (db && /^[a-z0-9_-]{1,40}$/i.test(campaign)) {
    await db.from("email_campaign_events").insert({ campaign, kind: "open", ua: req.headers.get("user-agent")?.slice(0, 200) ?? null });
  }
  return new Response(GIF, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, private" },
  });
}
