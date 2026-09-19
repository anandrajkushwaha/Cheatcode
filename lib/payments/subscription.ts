import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Turning a Razorpay webhook into an entitlement.
 *
 * ------------------------------------------------------- two kinds of status
 *
 * `subscriptions.status` is Razorpay's word for the mandate — active, halted,
 * cancelled. `profiles.plan_status` is the product's word for what the person
 * is allowed to use, and the two are not the same thing.
 *
 * A mandate that has been cancelled, or that is failing to charge, does not
 * take away the month already paid for. isPaid() already encodes this: it
 * accepts "active" and "cancelled" and then checks plan_expires_at. So every
 * ending state maps to "cancelled" — which reads as *will not renew* rather
 * than *is cut off* — and access simply lapses when the paid period does.
 *
 * "past_due" is deliberately never written here. It would fail isPaid()
 * immediately and cut somebody off mid-month for a retry that Razorpay is
 * still attempting on their behalf.
 *
 * ------------------------------------------------------------- the dates
 *
 * plan_expires_at comes from the charge event's current_end, never from
 * "now + 30 days". A retry, a pause or a mid-cycle change all move that date
 * at Razorpay's end, and a locally invented one drifts away from what the
 * customer was actually billed — silently, and always in one direction.
 */

type Entity = {
  id?: string;
  plan_id?: string;
  status?: string;
  current_start?: number | null;
  current_end?: number | null;
  paid_count?: number | null;
  short_url?: string | null;
  notes?: Record<string, string> | null;
};

export type WebhookEvent = {
  eventId: string;
  event: string;
  entity: Entity | null;
  payload: unknown;
};

/** Razorpay sends seconds; Postgres wants an ISO string. */
function at(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  const ms = seconds * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Which of Razorpay's states still mean "this mandate is running". */
const RUNNING = new Set(["authenticated", "active"]);

export type ApplyResult =
  | { ok: true; handled: boolean; note?: string }
  | { ok: false; error: string };

export async function applySubscriptionEvent(
  db: SupabaseClient,
  ev: WebhookEvent,
): Promise<ApplyResult> {
  /*
   * The memory, written first.
   *
   * Razorpay delivers at least once and will resend anything we are slow to
   * acknowledge. Claiming the event id before doing any work means a redelivery
   * collides here and stops, rather than granting a second month for the same
   * rupee. A unique violation is the success case, not an error.
   */
  const claim = await db.from("billing_events").insert({
    event_id: ev.eventId,
    event: ev.event,
    rzp_subscription_id: ev.entity?.id ?? null,
    payload: ev.payload as never,
  });

  if (claim.error) {
    if (claim.error.code === "23505") {
      return { ok: true, handled: false, note: "already processed" };
    }
    return { ok: false, error: claim.error.message };
  }

  const sub = ev.entity;
  if (!sub?.id) return { ok: true, handled: false, note: "no subscription in payload" };

  // Who this is. The row we already have is the better answer; the note on
  // the subscription is the fallback for an event that outran our own insert.
  const { data: existing } = await db
    .from("subscriptions")
    .select("user_id")
    .eq("rzp_subscription_id", sub.id)
    .maybeSingle();

  const userId = (existing?.user_id as string | undefined) ?? sub.notes?.user_id ?? null;
  if (!userId) {
    return { ok: true, handled: false, note: "no user for this subscription" };
  }

  const currentEnd = at(sub.current_end);

  const { error: upsertError } = await db.from("subscriptions").upsert(
    {
      user_id: userId,
      rzp_subscription_id: sub.id,
      rzp_plan_id: sub.plan_id ?? null,
      status: sub.status ?? "created",
      current_start: at(sub.current_start),
      current_end: currentEnd,
      charge_count: sub.paid_count ?? 0,
      short_url: sub.short_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "rzp_subscription_id" },
  );

  if (upsertError) return { ok: false, error: upsertError.message };

  // ------------------------------------------------------------ entitlement
  const running = RUNNING.has(sub.status ?? "");

  const profilePatch: Record<string, unknown> = {
    plan: "pro",
    plan_status: running ? "active" : "cancelled",
    updated_at: new Date().toISOString(),
  };

  // Only ever move the expiry forward. An out-of-order webhook carrying an
  // older period must not shorten a month somebody has already been given.
  if (currentEnd) {
    const { data: profile } = await db
      .from("profiles")
      .select("plan_expires_at")
      .eq("id", userId)
      .maybeSingle();

    const known = profile?.plan_expires_at as string | null | undefined;
    if (!known || new Date(currentEnd) > new Date(known)) {
      profilePatch.plan_expires_at = currentEnd;
    }
  }

  const { error: planError } = await db
    .from("profiles")
    .update(profilePatch)
    .eq("id", userId);

  if (planError) return { ok: false, error: planError.message };

  return { ok: true, handled: true };
}
