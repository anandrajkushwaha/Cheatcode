import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { isPaid, type Profile } from "@/lib/app/account";
import { isOwnerEmail } from "@/lib/analytics/owner";

/**
 * Paid access to matched jobs (115_job_unlocks.sql).
 *
 * The jobs that genuinely fit a resume (lib/jobs/matching.ts) are the paid
 * part of the board: the company, the details and the apply link stay hidden
 * until one of these is true —
 *
 *   Pro (₹299/month)       every match, always
 *   Match pass (₹99)       every match, for 7 days from payment
 *   Job unlock (₹49)       that one job, for good
 *
 * Jobs that are not a match stay free, as the board always was. Rows are
 * written only here, by the server: an order when checkout opens, and "paid"
 * once Razorpay's signature (or its order.paid webhook) proves the payment.
 */

export const PRICES = { job: 4900, pass: 9900 } as const;
export const PASS_DAYS = 7;
export type UnlockKind = keyof typeof PRICES;

export type Access = {
  /** Pro, a live pass, or the owner's test account: every match is open. */
  all: boolean;
  pro: boolean;
  passUntil: string | null;
  jobs: Set<string>;
};

export async function accessFor(userId: string, email: string | null, profile: Profile | null): Promise<Access> {
  const pro = isPaid(profile) || isOwnerEmail(email);
  const db = createAppAdminClient();
  const empty: Access = { all: pro, pro, passUntil: null, jobs: new Set() };
  if (!db) return empty;
  const { data, error } = await db
    .from("job_unlocks")
    .select("kind,job_id,expires_at")
    .eq("user_id", userId)
    .eq("status", "paid");
  if (error) return empty;
  const now = Date.now();
  let passUntil: string | null = null;
  const jobs = new Set<string>();
  for (const r of (data ?? []) as { kind: UnlockKind; job_id: string | null; expires_at: string | null }[]) {
    if (r.kind === "job" && r.job_id) jobs.add(r.job_id);
    if (r.kind === "pass" && r.expires_at && new Date(r.expires_at).getTime() > now) {
      if (!passUntil || r.expires_at > passUntil) passUntil = r.expires_at;
    }
  }
  return { all: pro || Boolean(passUntil), pro, passUntil, jobs };
}

export function canSee(access: Access, jobId: string): boolean {
  return access.all || access.jobs.has(jobId);
}

/** Record the order checkout is about to open. */
export async function recordOrder(userId: string, kind: UnlockKind, jobId: string | null, orderId: string): Promise<void> {
  const db = createAppAdminClient();
  if (!db) throw new Error("Unlocks aren't configured.");
  const { error } = await db.from("job_unlocks").insert({
    user_id: userId,
    kind,
    job_id: jobId,
    amount_paise: PRICES[kind],
    rzp_order_id: orderId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Mark an order paid. Idempotent: checkout's callback and the webhook both
 * call it, in either order, and the second is a no-op. A pass's 7 days start
 * at payment, not at order creation.
 */
export async function markPaid(orderId: string, paymentId: string, userId?: string): Promise<boolean> {
  const db = createAppAdminClient();
  if (!db) return false;
  let q = db.from("job_unlocks").select("id,kind,status").eq("rzp_order_id", orderId);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.maybeSingle();
  const row = data as { id: string; kind: UnlockKind; status: string } | null;
  if (!row) return false;
  if (row.status === "paid") return true;
  const now = new Date();
  const { error } = await db
    .from("job_unlocks")
    .update({
      status: "paid",
      rzp_payment_id: paymentId,
      paid_at: now.toISOString(),
      expires_at: row.kind === "pass" ? new Date(now.getTime() + PASS_DAYS * 86_400_000).toISOString() : null,
    })
    .eq("id", row.id)
    .eq("status", "created");
  return !error;
}
