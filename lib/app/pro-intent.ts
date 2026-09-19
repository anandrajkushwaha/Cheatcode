import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { getSessionUser } from "@/lib/supabase/app";

/**
 * Write down that somebody reached for the paid plan.
 *
 * Called from the upgrade screen itself rather than from a click handler on
 * each button. Three reasons, in order of how much they matter:
 *
 *   1. Every route into the plan ends here, including ones added later, so
 *      there is no button that quietly goes unrecorded.
 *   2. It needs no client JavaScript at all, which means no fetch that can be
 *      blocked, fail on a bad connection, or be lost when the page navigates
 *      away mid-request.
 *   3. It touches one file in the live app instead of four.
 *
 * The cost of doing it this way is that a refresh looks like a second click,
 * which the window below handles.
 */

/**
 * Repeat visits inside this window are the same intent, not a new one.
 *
 * Someone reads the plan, opens a new tab, comes back, refreshes. Counting
 * that as four people wanting to pay would make the only number this table
 * exists to produce useless.
 */
const DEDUPE_MINUTES = 30;

export async function recordProIntent(source: string, path: string): Promise<void> {
  try {
    const user = await getSessionUser();
    if (!user) return;

    const db = createAppAdminClient();
    if (!db) return;

    const since = new Date(Date.now() - DEDUPE_MINUTES * 60_000).toISOString();

    const { data: recent } = await db
      .from("pro_intent")
      .select("id")
      .eq("user_id", user.id)
      .eq("source", source)
      .gte("created_at", since)
      .limit(1);

    if (recent && recent.length > 0) return;

    await db.from("pro_intent").insert({
      user_id: user.id,
      email: user.email ?? null,
      source: source.slice(0, 64),
      path: path.slice(0, 200),
    });
  } catch {
    /*
     * Recording interest must never be the reason somebody cannot read the
     * pricing. A missing table, a dropped connection, a policy change — all
     * of it fails quietly here and shows up as a gap in the admin screen,
     * which is the right place to notice it.
     */
  }
}
