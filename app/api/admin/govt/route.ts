import { requireAdmin } from "@/lib/admin/guard";
import { createAppAdminClient } from "@/lib/supabase/app";
import { runGovtIngest } from "@/lib/govt/ingest";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Run the monitor now, from the dashboard.
 *
 * The same function the cron calls — not a second path that does nearly the
 * same thing. That matters more here than anywhere else in this feature: the
 * whole point of a button is to find out what the scheduled run will do, and
 * a button that exercises different code answers a different question.
 *
 * Authorised by the admin session rather than by the cron secret, so pressing
 * it never involves anybody handling a secret.
 */
export async function POST() {
  const guard = await requireAdmin("govt");
  if (!guard.ok) return guard.response;

  const db = createAppAdminClient();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase isn't configured." }, { status: 503 });
  }

  try {
    return Response.json(await runGovtIngest(db));
  } catch (e) {
    // A browser that cannot start, a board that hangs past the function's
    // limit — reported as itself rather than as an empty result, because an
    // empty result here reads as "the boards had nothing", which is a
    // different and much more reassuring thing than "the run broke".
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, sources: [], added: 0, remaining: 0, error: message }, { status: 500 });
  }
}
