import { timingSafeEqual as constantTimeEqual } from "node:crypto";
import { createAppAdminClient } from "@/lib/supabase/app";
import { runInsightsIngest } from "@/lib/insights/ingest";

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
  const denied = authorise(request);
  if (denied) return denied;

  const db = createAppAdminClient();
  if (!db) {
    return Response.json({ ok: false, error: "Supabase is not configured" }, { status: 503 });
  }

  return Response.json(await runInsightsIngest(db));
}

/**
 * Two ways in, both secrets.
 *
 * Vercel Cron sends a bearer token it holds itself, which is the path used in
 * production. The header is there so a run can be triggered by hand without
 * handing anybody the cron secret.
 */
function authorise(request: Request): Response | null {
  const cron = process.env.CRON_SECRET;
  const manual = process.env.INGEST_SECRET;

  const auth = request.headers.get("authorization");
  if (cron && auth === `Bearer ${cron}`) return null;

  const header = request.headers.get("x-ingest-secret");
  if (manual && header && safeEqual(header, manual)) return null;

  return Response.json({ ok: false, error: "Not authorised" }, { status: 401 });
}

/** Constant time, so the response time cannot be used to guess the secret. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && constantTimeEqual(left, right);
}
