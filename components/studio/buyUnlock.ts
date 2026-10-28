"use client";

import { loadCheckout } from "@/components/studio/PayButton";
import { EVENTS, track } from "@/lib/analytics/events";
import { metaTrack } from "@/lib/analytics/meta";

/**
 * Buy a job unlock (₹49) or the 7-day match pass (₹99) with Razorpay checkout.
 *
 * The server creates the order and sets the amount; the browser only opens
 * the sheet and hands the signed result back to /api/app/unlock/verify, which
 * opens the unlock at once (the order.paid webhook backs it up).
 */
export type BuyResult = { ok: true } | { ok: false; cancelled?: boolean; error?: string };

export async function buyUnlock(kind: "job" | "pass", jobId?: string): Promise<BuyResult> {
  track(EVENTS.BUILDER_STEP, { label: "unlock_start", kind });
  const res = await fetch("/api/app/unlock/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, jobId }),
  }).catch(() => null);
  const order = (await res?.json().catch(() => null)) as
    | { ok?: boolean; error?: string; orderId?: string; amount?: number; keyId?: string; prefill?: Record<string, string> }
    | null;
  if (!order?.ok || !order.orderId) return { ok: false, error: order?.error ?? "Couldn't start the payment." };

  if (!(await loadCheckout()) || !window.Razorpay) return { ok: false, error: "Couldn't open the payment window." };

  return new Promise<BuyResult>((resolve) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: "INR",
      name: "Cheatcode",
      description: kind === "pass" ? "All matching jobs · 7 days" : "Unlock this job",
      prefill: order.prefill,
      theme: { color: "#15161A" },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const v = await fetch("/api/app/unlock/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }),
        }).catch(() => null);
        if (v?.ok) {
          track(EVENTS.BUILDER_STEP, { label: "unlock_paid", kind });
          metaTrack("Purchase", { value: (order.amount ?? 0) / 100, currency: "INR", content_name: kind });
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: "Payment received — it will unlock in a minute. Refresh if it doesn't." });
        }
      },
      modal: { ondismiss: () => resolve({ ok: false, cancelled: true }) },
    });
    rzp.open();
  });
}
