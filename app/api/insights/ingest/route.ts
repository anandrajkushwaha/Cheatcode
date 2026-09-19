import { timingSafeEqual as constantTimeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createAppAdminClient } from "@/lib/supabase/app";
import { runInsightsIngest } from "@/lib/insights/ingest";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The scheduled entry point for the insights feed.
 *
 * Deliberately identical in shape to /api/jobs/ingest — same two ways in,
 * same secrets, same "the work lives in lib" split — because these are the
 * same kind of thing and somebody debugging one at 2am should not have to
 * learn a second set of conventions.
 */
export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const denied = await authorise(request);
  if (denied) return denied;

  const db = createAppAdminClient();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured" }, { status: 503 });
  }

  return Response.json(await runInsightsIngest(db));
}

/**
 * Three ways in.
 *
 * Vercel Cron sends a bearer token it holds itself, which is the path used in
 * production. The header is there so a run can be triggered by a script
 * without handing anybody the cron secret.
 *
 * The third is a signed-in admin session, and it was added for a reason worth
 * recording: a scheduled feed is invisible until the schedule fires. On a
 * daily cron that is up to a day of staring at an empty panel with no way to
 * tell "nothing ingested yet" from "this is broken". An admin can now open
 * this URL in a browser and read the run's own report — which sources were
 * tried, what each one returned, and the exact error where one failed.
 *
 * It is the same cookie the admin panel itself trusts, so it grants nothing
 * that a logged-in admin did not already have.
 */
async function authorise(request: Request): Promise<Response | null> {
  const cron = process.env.CRON_SECRET;
  const manual = process.env.INGEST_SECRET;

  const auth = request.headers.get("authorization");
  if (cron && auth === `Bearer ${cron}`) return null;

  const header = request.headers.get("x-ingest-secret");
  if (manual && header && safeEqual(header, manual)) return null;

  const jar = await cookies();
  if (verifySessionToken(jar.get(ADMIN_COOKIE)?.value)) return null;

  return Response.json({ ok: false, error: "Not authorised" }, { status: 401 });
}

/** Constant time, so the response time cannot be used to guess the secret. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && constantTimeEqual(left, right);
}
