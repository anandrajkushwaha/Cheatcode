import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminSession } from "@/lib/admin/auth";

/**
 * Whose name goes on the row.
 *
 * Resolved at write time and stored as text, not as a reference to the
 * account. An account can be switched off or removed — which is the normal
 * end of an agency engagement — and "who posted this notice" should still
 * have an answer afterwards. Same reasoning as insights.author_name.
 */
export async function adminDisplayName(session: AdminSession): Promise<string> {
  if (session.role === "owner") return "Owner";

  const db = createAdminClient();
  if (!db || !session.uid) return "Team member";

  const { data } = await db
    .from("admin_users")
    .select("name, username")
    .eq("id", session.uid)
    .maybeSingle();

  const row = data as { name: string | null; username: string } | null;
  return row ? row.name?.trim() || row.username : "Team member";
}
