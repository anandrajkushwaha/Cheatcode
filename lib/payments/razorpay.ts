import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay, over fetch.
 *
 * No SDK. Everything needed here is three REST calls and two HMACs, and the
 * official package would add a dependency to the server bundle for that — one
 * more thing to keep patched, on the one code path where a supply-chain
 * surprise would be worst.
 *
 * ------------------------------------------------------------- the secrets
 *
 * Four environment variables, none of which belong in the repository:
 *
 *   RAZORPAY_KEY_ID          the key id, also handed to checkout in the browser
 *   RAZORPAY_KEY_SECRET      signs API calls and the checkout callback
 *   RAZORPAY_PLAN_ID         the ₹299/month plan, created once in their dashboard
 *   RAZORPAY_WEBHOOK_SECRET  a different secret, set when you add the webhook
 *
 * The webhook secret is deliberately not the key secret. If one leaks the
 * other still holds, and only one of them can move money.
 */

const API = "https://api.razorpay.com/v1";

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  planId: string;
};

/** Null when billing is not configured, which is a normal state, not an error. */
export function razorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const planId = process.env.RAZORPAY_PLAN_ID?.trim();
  if (!keyId || !keySecret || !planId) return null;
  return { keyId, keySecret, planId };
}

export function billingConfigured(): boolean {
  return razorpayConfig() !== null;
}

function authHeader(cfg: RazorpayConfig): string {
  return `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString("base64")}`;
}

/* ------------------------------------------------------------ subscriptions */

export type CreatedSubscription = {
  id: string;
  status: string;
  planId: string;
  shortUrl: string | null;
};

/**
 * Open a mandate for this person.
 *
 * `total_count` is how many cycles the mandate may ever run — Razorpay
 * requires a number, there is no "forever". Ten years of months is the
 * practical version of forever; the customer can cancel at any point and the
 * count is not a commitment they can see.
 *
 * The user id goes in `notes` so a webhook that arrives about a subscription
 * we somehow have no row for can still be attributed to a person.
 */
export async function createSubscription(
  cfg: RazorpayConfig,
  opts: { userId: string; email: string | null; name: string | null },
): Promise<{ ok: true; data: CreatedSubscription } | { ok: false; error: string }> {
  let res: Response;

  try {
    res = await fetch(`${API}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: authHeader(cfg),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: cfg.planId,
        total_count: 120,
        customer_notify: 1,
        notes: {
          user_id: opts.userId,
          email: opts.email ?? "",
          name: opts.name ?? "",
        },
      }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Could not reach Razorpay" };
  }

  const body = (await res.json().catch(() => null)) as
    | { id?: string; status?: string; plan_id?: string; short_url?: string; error?: { description?: string } }
    | null;

  if (!res.ok || !body?.id) {
    // Logged so a failure is diagnosable from the function logs. The key id is
    // public (checkout receives it); the secret is never logged.
    console.error("[razorpay] create subscription failed", {
      status: res.status,
      keyId: cfg.keyId,
      keyIdMode: cfg.keyId.startsWith("rzp_test_") ? "test" : cfg.keyId.startsWith("rzp_live_") ? "live" : "unknown",
      secretLength: cfg.keySecret.length,
      planId: cfg.planId,
      body,
    });
    return {
      ok: false,
      error: body?.error?.description ?? `Razorpay returned ${res.status}`,
    };
  }

  return {
    ok: true,
    data: {
      id: body.id,
      status: body.status ?? "created",
      planId: body.plan_id ?? cfg.planId,
      shortUrl: body.short_url ?? null,
    },
  };
}

/* ---------------------------------------------------------------- signatures */

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * The signature checkout hands back when a mandate is authorised.
 *
 * Note the order: payment id, then subscription id. Orders sign the other way
 * round (order id, then payment id) and getting the two confused is the
 * classic way to ship a verifier that rejects every real payment — or, worse,
 * one that is written to match and accidentally accepts anything.
 */
export function verifyCheckoutSignature(
  cfg: RazorpayConfig,
  args: { paymentId: string; subscriptionId: string; signature: string },
): boolean {
  const expected = createHmac("sha256", cfg.keySecret)
    .update(`${args.paymentId}|${args.subscriptionId}`)
    .digest("hex");
  return safeEqualHex(expected, args.signature);
}

/**
 * The webhook signature, over the exact bytes Razorpay sent.
 *
 * It must be the raw body. Parsing to an object and re-serialising changes
 * key order and whitespace, and the digest stops matching — which usually
 * gets "fixed" by dropping the check, at which point anybody who knows the
 * URL can grant themselves a subscription.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

/* --------------------------------------------------------- one-time orders */

/**
 * The keys alone, for one-time orders (job unlocks). Orders need no plan, so a
 * deployment that has not created a subscription plan can still sell them.
 */
export function razorpayKeys(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return keyId && keySecret ? { keyId, keySecret } : null;
}

/** A one-time order for `amountPaise`. The user id travels in notes, for the webhook. */
export async function createOrder(
  keys: { keyId: string; keySecret: string },
  opts: { amountPaise: number; receipt: string; notes: Record<string, string> },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: opts.amountPaise, currency: "INR", receipt: opts.receipt.slice(0, 40), notes: opts.notes }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Could not reach Razorpay" };
  }
  const body = (await res.json().catch(() => null)) as { id?: string; error?: { description?: string } } | null;
  if (!res.ok || !body?.id) {
    console.error("[razorpay] create order failed", { status: res.status, body });
    return { ok: false, error: body?.error?.description ?? `Razorpay returned ${res.status}` };
  }
  return { ok: true, id: body.id };
}

/** The signature checkout hands back for an order: order id, then payment id. */
export function verifyOrderSignature(
  keys: { keySecret: string },
  args: { orderId: string; paymentId: string; signature: string },
): boolean {
  const expected = createHmac("sha256", keys.keySecret).update(`${args.orderId}|${args.paymentId}`).digest("hex");
  return safeEqualHex(expected, args.signature);
}

/* ------------------------------------------------------ the Pro plan price */

/** Pro is ₹299 a month (lib/studio/plan.ts shows the same number). */
export const PRO_AMOUNT_PAISE = 29900;

let proPlanCache: string | null = null;

/**
 * The id of a Razorpay plan that charges exactly PRO_AMOUNT_PAISE a month.
 *
 * Razorpay plans can't be repriced, so a price change means a new plan — and
 * a new plan id pasted into the environment, which is easy to forget (the
 * screen said ₹299 while checkout still charged the old ₹99). Instead: use
 * RAZORPAY_PLAN_ID if it already charges the right amount; otherwise use the
 * plan this function created before (remembered in feature_flags); otherwise
 * create one through the API and remember it.
 */
export async function ensureProPlan(cfg: RazorpayConfig): Promise<string> {
  if (proPlanCache) return proPlanCache;
  const auth = authHeader(cfg);
  const { createAppAdminClient } = await import("@/lib/supabase/app");
  const db = createAppAdminClient();
  const KEY = "razorpay_pro_plan";

  if (db) {
    const { data } = await db.from("feature_flags").select("value").eq("key", KEY).maybeSingle();
    const v = (data as { value?: { planId?: string; amount?: number } } | null)?.value;
    if (v?.planId && v.amount === PRO_AMOUNT_PAISE) return (proPlanCache = v.planId);
  }

  const amountOf = async (id: string): Promise<number | null> => {
    const r = await fetch(`${API}/plans/${encodeURIComponent(id)}`, { headers: { Authorization: auth }, cache: "no-store" }).catch(() => null);
    const b = (await r?.json().catch(() => null)) as { item?: { amount?: number } } | null;
    return r?.ok ? (b?.item?.amount ?? null) : null;
  };

  let planId: string | null = (await amountOf(cfg.planId)) === PRO_AMOUNT_PAISE ? cfg.planId : null;
  if (!planId) {
    const r = await fetch(`${API}/plans`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        period: "monthly",
        interval: 1,
        item: { name: "Cheatcode Pro", amount: PRO_AMOUNT_PAISE, currency: "INR", description: "Cheatcode Pro – monthly" },
      }),
      cache: "no-store",
    }).catch(() => null);
    const b = (await r?.json().catch(() => null)) as { id?: string; error?: { description?: string } } | null;
    if (!r?.ok || !b?.id) {
      console.error("[razorpay] create plan failed", { status: r?.status, body: b });
      // Fall back to the configured plan rather than refusing the sale.
      return cfg.planId;
    }
    planId = b.id;
  }

  if (db) {
    await db
      .from("feature_flags")
      .upsert({ key: KEY, enabled: true, value: { planId, amount: PRO_AMOUNT_PAISE }, updated_at: new Date().toISOString(), note: "Created by ensureProPlan" }, { onConflict: "key" });
  }
  return (proPlanCache = planId);
}
