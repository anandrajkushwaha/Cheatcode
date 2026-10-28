import { getSessionUser } from "@/lib/supabase/app";
import { razorpayKeys, verifyOrderSignature } from "@/lib/payments/razorpay";
import { markPaid } from "@/lib/jobs/unlocks";

export const dynamic = "force-dynamic";

/**
 * Checkout's success callback. The signature is the proof — an order signed
 * with our secret by Razorpay — so the unlock can open at once instead of
 * waiting for the webhook (which also marks it, idempotently).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const keys = razorpayKeys();
  if (!keys) return Response.json({ ok: false, error: "Payments aren't switched on yet." }, { status: 503 });

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const orderId = typeof b.orderId === "string" ? b.orderId : "";
  const paymentId = typeof b.paymentId === "string" ? b.paymentId : "";
  const signature = typeof b.signature === "string" ? b.signature : "";
  if (!orderId || !paymentId || !verifyOrderSignature(keys, { orderId, paymentId, signature })) {
    return Response.json({ ok: false, error: "We couldn't confirm that payment." }, { status: 400 });
  }
  const ok = await markPaid(orderId, paymentId, user.id);
  return Response.json({ ok }, { status: ok ? 200 : 500 });
}
