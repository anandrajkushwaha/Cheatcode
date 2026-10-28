import { getSessionUser } from "@/lib/supabase/app";
import { getProfile } from "@/lib/app/account";
import { createOrder, razorpayKeys } from "@/lib/payments/razorpay";
import { getJob } from "@/lib/jobs/applications";
import { PRICES, recordOrder, type UnlockKind } from "@/lib/jobs/unlocks";

export const dynamic = "force-dynamic";

/**
 * Open a one-time order: ₹49 for one matched job, ₹99 for every match for 7
 * days. The amount comes from here, never from the browser.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const keys = razorpayKeys();
  if (!keys) return Response.json({ ok: false, error: "Payments aren't switched on yet." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; jobId?: unknown };
  const kind = body.kind === "job" || body.kind === "pass" ? (body.kind as UnlockKind) : null;
  if (!kind) return Response.json({ ok: false, error: "Unknown purchase." }, { status: 400 });

  let jobId: string | null = null;
  if (kind === "job") {
    const job = typeof body.jobId === "string" ? await getJob(body.jobId) : null;
    if (!job) return Response.json({ ok: false, error: "That job is no longer listed." }, { status: 404 });
    jobId = job.id;
  }

  const order = await createOrder(keys, {
    amountPaise: PRICES[kind],
    receipt: `${kind}-${user.id.slice(0, 8)}-${Date.now()}`,
    notes: { user_id: user.id, kind, job_id: jobId ?? "" },
  });
  if (!order.ok) return Response.json({ ok: false, error: "Couldn't start the payment. Try again." }, { status: 502 });

  try {
    await recordOrder(user.id, kind, jobId, order.id);
  } catch (e) {
    console.error("unlock/order: record failed", String(e).slice(0, 200));
    return Response.json({ ok: false, error: "Couldn't start the payment. Try again." }, { status: 500 });
  }

  const profile = await getProfile();
  return Response.json({
    ok: true,
    orderId: order.id,
    amount: PRICES[kind],
    keyId: keys.keyId,
    prefill: { name: profile?.full_name ?? "", email: profile?.email ?? user.email ?? "", contact: profile?.phone ?? "" },
  });
}
