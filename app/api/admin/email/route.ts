import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/admin/guard";
import { createAppAdminClient } from "@/lib/supabase/app";
import { getSegments } from "@/lib/email/segments";
import { CAMPAIGN, renderAtsUpload } from "@/lib/email/ats-upload";
import { emailConfigured, sendEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Send the ATS-upload email: one test copy to an address you name, or the
 * next batch of real recipients. Owner only — it sends mail to customers.
 *
 * Each person gets the campaign once (a unique index on campaign + email),
 * people who unsubscribed are never selected, and a batch is capped at 30 so
 * it finishes inside one function run with a pause between sends.
 */
const SEGMENT = "resume_no_match";
const MAX_BATCH = 30;

const token = () => randomBytes(16).toString("hex");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!emailConfigured()) {
    return Response.json({ ok: false, error: "Set SMTP_USER and SMTP_PASS in Vercel first." }, { status: 400 });
  }
  const db = createAppAdminClient();
  if (!db) return Response.json({ ok: false, error: "Supabase isn't configured." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; to?: string; limit?: number };
  const seg = await getSegments();
  if (!seg.ok) return Response.json(seg, { status: 500 });

  if (body.action === "test") {
    const to = String(body.to ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return Response.json({ ok: false, error: "Give a valid email address." }, { status: 400 });
    const t = token();
    await db.from("email_sends").insert({ campaign: CAMPAIGN, segment: SEGMENT, email: to, token: t, status: "test" });
    const mail = renderAtsUpload({ firstName: "Test", openJobs: seg.openJobs, teasers: seg.teasers, token: t });
    const r = await sendEmail({ to, ...mail });
    await db.from("email_sends").update(r.ok ? { sent_at: new Date().toISOString() } : { error: r.error }).eq("token", t);
    return Response.json(r.ok ? { ok: true, sent: 1 } : { ok: false, error: r.error }, { status: r.ok ? 200 : 500 });
  }

  if (body.action === "send") {
    const limit = Math.max(1, Math.min(MAX_BATCH, Number(body.limit) || 25));
    const { data: done } = await db.from("email_sends").select("email").eq("campaign", CAMPAIGN).neq("status", "test");
    const already = new Set(((done ?? []) as { email: string }[]).map((d) => d.email.toLowerCase()));
    const batch = seg.people.filter((p) => p.segment === SEGMENT && !already.has(p.email)).slice(0, limit);

    let sent = 0;
    const failed: string[] = [];
    for (const p of batch) {
      const t = token();
      const { error } = await db
        .from("email_sends")
        .insert({ campaign: CAMPAIGN, segment: SEGMENT, user_id: p.userId, email: p.email, token: t, status: "queued" });
      if (error) continue; // already sent to this address (unique index)
      const mail = renderAtsUpload({ firstName: p.name, openJobs: seg.openJobs, teasers: seg.teasers, token: t });
      const r = await sendEmail({ to: p.email, ...mail });
      await db
        .from("email_sends")
        .update(r.ok ? { status: "sent", sent_at: new Date().toISOString() } : { status: "failed", error: r.error })
        .eq("token", t);
      if (r.ok) sent += 1;
      else failed.push(`${p.email}: ${r.error}`);
      await wait(1200);
    }
    return Response.json({ ok: true, sent, failed, remaining: seg.people.filter((p) => p.segment === SEGMENT).length - already.size - sent });
  }

  return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
