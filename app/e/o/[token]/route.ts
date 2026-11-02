import { createAppAdminClient } from "@/lib/supabase/app";

export const dynamic = "force-dynamic";

// A transparent 1×1 GIF.
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/**
 * The open pixel. Approximate by nature: Gmail fetches images through its
 * own proxy (so an open is recorded, but late and without a device), and
 * Apple Mail fetches every image on delivery (so some "opens" are nobody).
 * Clicks are the number to trust.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createAppAdminClient();
  if (db && /^[a-z0-9]{16,64}$/i.test(token)) {
    const { data } = await db.from("email_sends").select("id,open_count,opened_at").eq("token", token).maybeSingle();
    const row = data as { id: string; open_count: number; opened_at: string | null } | null;
    if (row) {
      await db
        .from("email_sends")
        .update({ open_count: row.open_count + 1, opened_at: row.opened_at ?? new Date().toISOString() })
        .eq("id", row.id);
    }
  }
  return new Response(GIF, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate, private" },
  });
}
