import { createAppAdminClient } from "@/lib/supabase/app";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { applySubscriptionEvent } from "@/lib/payments/subscription";

export const dynamic = "force-dynamic";

/**
 * Razorpay's webhook, and the only thing that actually grants a plan.
 *
 * The checkout callback in the browser is a convenience — it tells us the
 * person got through the sheet. It is not evidence: the tab can be closed
 * before it fires, the network can drop it, and anything a browser sends can
 * be sent by anything else. This endpoint is the authority, and it is the
 * only place that writes an entitlement.
 *
 * ------------------------------------------------------------- the raw body
 *
 * The signature covers the exact bytes Razorpay sent. request.json() would
 * reorder keys and drop whitespace and the digest would stop matching — which
 * is usually "fixed" by weakening the check, and a webhook without a verified
 * signature is a URL that hands out subscriptions to whoever finds it.
 *
 * ------------------------------------------------------------- always 200
 *
 * A non-2xx makes Razorpay retry, which is right for a transient failure and
 * wrong for a payload we will never understand. Signature failures answer 400
 * so a misconfigured secret is loud; everything accepted answers 200, and the
 * detail of what we did with it goes in the body and the logs.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature)) {
    return Response.json({ ok: false, error: "Bad signature" }, { status: 400 });
  }

  let body: {
    event?: string;
    payload?: { subscription?: { entity?: Record<string, unknown> } };
  };

  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event ?? "";
  if (!event.startsWith("subscription.")) {
    return Response.json({ ok: true, note: "not a subscription event" });
  }

  const db = createAppAdminClient();
  if (!db) {
    // This one *should* be retried: the event is good, we are not ready.
    return Response.json({ ok: false, error: "Not configured" }, { status: 503 });
  }

  /*
   * The event id, which is what makes this idempotent.
   *
   * Razorpay sends it as a header. Without it there is nothing stable to key
   * on — the payload repeats on every retry — so a missing header is refused
   * rather than processed blind.
   */
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId) {
    return Response.json({ ok: false, error: "Missing event id" }, { status: 400 });
  }

  const result = await applySubscriptionEvent(db, {
    eventId,
    event,
    entity: (body.payload?.subscription?.entity ?? null) as never,
    payload: body,
  });

  if (!result.ok) {
    console.error("[razorpay webhook]", event, result.error);
    // Ours to fix, and worth retrying once we have.
    return Response.json({ ok: false, error: result.error }, { status: 500 });
  }

  return Response.json({ ok: true, handled: result.handled, note: result.note });
}
