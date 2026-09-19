import { createAppAdminClient } from "@/lib/supabase/app";
import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, isPaid } from "@/lib/app/account";
import { createSubscription, razorpayConfig } from "@/lib/payments/razorpay";

export const dynamic = "force-dynamic";

/**
 * Open a mandate for the signed-in person.
 *
 * The browser sends nothing but a request. No amount, no plan, no user id —
 * all three come from the session and the environment, because a checkout
 * that accepts a price from the page it is rendered on is a checkout anybody
 * can talk down to a rupee.
 *
 * What comes back is a subscription id and the public key id. Neither is a
 * secret: the key id is designed to sit in a browser, and the subscription id
 * is useless without the mandate the customer is about to authorise.
 */
export async function POST() {
  const cfg = razorpayConfig();
  if (!cfg) {
    return Response.json(
      { ok: false, error: "Payments are not configured yet." },
      { status: 503 },
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const profile = await getProfile();
  if (isPaid(profile)) {
    return Response.json(
      { ok: false, error: "You are already on Pro." },
      { status: 409 },
    );
  }

  const db = createAppAdminClient();
  if (!db) {
    return Response.json(
      { ok: false, error: "Accounts are not configured." },
      { status: 503 },
    );
  }

  /*
   * Reuse a mandate this person has already opened but not yet authorised.
   *
   * Somebody who presses the button, closes the sheet and presses it again
   * would otherwise leave a trail of dangling subscriptions at Razorpay's
   * end — each of which can still be authorised later, and two authorised
   * mandates means two charges a month.
   */
  const { data: open } = await db
    .from("subscriptions")
    .select("rzp_subscription_id, status")
    .eq("user_id", user.id)
    .in("status", ["created", "authenticated"])
    .order("created_at", { ascending: false })
    .limit(1);

  const reusable = open?.[0]?.rzp_subscription_id as string | undefined;
  if (reusable) {
    return Response.json({ ok: true, subscriptionId: reusable, keyId: cfg.keyId });
  }

  const created = await createSubscription(cfg, {
    userId: user.id,
    email: user.email ?? null,
    name: profile?.full_name ?? null,
  });

  if (!created.ok) {
    return Response.json({ ok: false, error: created.error }, { status: 502 });
  }

  const { error } = await db.from("subscriptions").insert({
    user_id: user.id,
    rzp_subscription_id: created.data.id,
    rzp_plan_id: created.data.planId,
    status: created.data.status,
    short_url: created.data.shortUrl,
  });

  if (error) {
    // The mandate exists at Razorpay's end either way; the webhook carries the
    // user id in its notes, so a failed insert here is recoverable rather than
    // a lost customer. Worth saying out loud in the logs.
    console.error("[billing] subscription created but not stored:", error.message);
  }

  return Response.json({ ok: true, subscriptionId: created.data.id, keyId: cfg.keyId });
}
