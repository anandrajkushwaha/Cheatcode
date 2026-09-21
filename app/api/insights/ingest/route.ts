import { createAppAdminClient } from "@/lib/supabase/app";
import { runInsightsIngest } from "@/lib/insights/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron calls this every morning (vercel.json). The same secrets as the
 * jobs sync: CRON_SECRET from Vercel, or INGEST_SECRET in an x-ingest-secret
 * header to run it by hand.
 */
export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  const cron = process.env.CRON_SECRET;
  const manual = process.env.INGEST_SECRET;
  const auth = request.headers.get("authorization");
  const header = request.headers.get("x-ingest-secret");
  const allowed =
    (cron && auth === `Bearer ${cron}`) || (manual && header && same(header, manual));
  if (!allowed) return Response.json({ ok: false, error: "Not authorised" }, { status: 401 });

  const db = createAppAdminClient();
  if (!db) return Response.json({ ok: false, error: "Supabase is not configured" }, { status: 503 });

  return Response.json(await runInsightsIngest(db));
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
