import { createAppAdminClient } from "@/lib/supabase/app";
import { runGovtIngest } from "@/lib/govt/ingest";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * The scheduled entry point for the government-jobs monitor. Once a day.
 *
 * Node rather than the edge because it drives a browser, and given two minutes
 * because a cold container has to fetch and unpack Chrome before it can render
 * anything. Every later board in the same run reuses it, which is most of why
 * all ten fit in one morning rather than needing a trigger each.
 *
 * The work lives in lib/govt/ingest.ts so the admin button runs exactly the
 * same code as the cron — two paths into one function, which is the only way
 * "it works when I press it" and "it works at four in the morning" stay the
 * same statement.
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

  return Response.json(await runGovtIngest(db));
}

/**
 * Two ways in, both secrets. Same shape as /api/jobs/ingest: Vercel Cron sends
 * the bearer token it holds, and the header is there so a run can be triggered
 * by hand without handing anybody the cron secret.
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
