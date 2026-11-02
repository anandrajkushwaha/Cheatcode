import { createAppAdminClient } from "@/lib/supabase/app";

export const dynamic = "force-dynamic";

/**
 * Unsubscribe. GET shows a one-button page rather than unsubscribing on the
 * spot, because mail scanners open every link in an email and would
 * unsubscribe people who never asked. POST does it — that is also what
 * Gmail's one-click unsubscribe (List-Unsubscribe-Post) sends.
 */
const page = (body: string) =>
  new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribe — Cheatcode</title></head><body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f4f5"><div style="max-width:420px;margin:60px auto;background:#fff;border-radius:16px;padding:28px 24px;text-align:center">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return page(
    `<h1 style="font-size:20px;margin:0">Stop these emails?</h1><p style="color:#6e6e76;font-size:14px">You will not get job or resume emails from Cheatcode again. Your account stays as it is.</p><form method="post" action="/e/u/${encodeURIComponent(token)}"><button style="margin-top:8px;background:#0b0b0f;color:#fff;border:0;border-radius:999px;padding:12px 22px;font-size:15px;cursor:pointer">Unsubscribe</button></form>`,
  );
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createAppAdminClient();
  if (db && /^[a-z0-9]{16,64}$/i.test(token)) {
    const { data } = await db.from("email_sends").select("id,email").eq("token", token).maybeSingle();
    const row = data as { id: string; email: string } | null;
    if (row) {
      await db.from("email_optouts").upsert({ email: row.email.toLowerCase() });
      await db.from("email_sends").update({ unsubscribed_at: new Date().toISOString() }).eq("id", row.id);
    }
  }
  return page(`<h1 style="font-size:20px;margin:0">You are unsubscribed</h1><p style="color:#6e6e76;font-size:14px">No more emails from us. Changed your mind? Write to support@cheatcodeapp.com.</p>`);
}
