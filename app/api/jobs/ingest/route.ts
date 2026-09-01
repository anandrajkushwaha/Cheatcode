import { createAppAdminClient } from "@/lib/supabase/app";
import { runIngest } from "@/lib/jobs/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The scheduled entry point. Vercel Cron calls this; the work itself lives in
 * lib/jobs/ingest.ts so the dashboard button runs exactly the same code.
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

  return Response.json(await runIngest(db));
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
  if (manual && header && timingSafeEqual(header, manual)) return null;

  return Response.json({ ok: false, error: "Not authorised" }, { status: 401 });
}

/** Constant time, so the response time cannot be used to guess the secret. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
