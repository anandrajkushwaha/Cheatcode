import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { sanitizeTouch } from "@/lib/analytics/attribution";

/**
 * Record what first brought an account holder here, once.
 *
 * The browser keeps the first source it ever saw in a `cc_ft` cookie
 * (lib/analytics/events.ts). The first time that person opens the app with
 * the column still empty, it is copied onto their profile — whichever way
 * they signed in, Google or phone. Never overwritten afterwards.
 *
 * Quiet on every failure: a missing column (91_attribution.sql not run) or a
 * mangled cookie just means the row stays blank.
 */
export async function recordSignupSource(userId: string, rawCookie: string | undefined) {
  if (!rawCookie) return;
  let parsed: { s?: string; m?: string; c?: string | null; l?: string; t?: string };
  try {
    parsed = JSON.parse(decodeURIComponent(rawCookie));
  } catch {
    return;
  }
  const touch = sanitizeTouch({ source: parsed.s, medium: parsed.m, campaign: parsed.c });
  if (!touch) return;

  const db = createAppAdminClient();
  if (!db) return;

  const seen = parsed.t && !Number.isNaN(Date.parse(parsed.t)) ? parsed.t : null;
  await db
    .from("profiles")
    .update({
      signup_source: touch.source,
      signup_medium: touch.medium,
      signup_campaign: touch.campaign,
      signup_landing: typeof parsed.l === "string" ? parsed.l.slice(0, 120) : null,
      first_seen_at: seen,
    })
    .eq("id", userId)
    .is("signup_source", null);
}
