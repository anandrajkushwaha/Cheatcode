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
 *   RAZORPAY_PLAN_ID         the ₹99/month plan, created once in their dashboard
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
