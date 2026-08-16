/**
 * Keeping your own traffic out of your own numbers.
 *
 * There are three separate ways this has to work, because they fail at
 * different moments:
 *
 *  1. A long-lived `cc_owner` cookie. Readable by JavaScript on purpose —
 *     it is the only way to stop Google Analytics, which is written to
 *     straight from the browser and never sees our server.
 *  2. The admin session cookie. Covers you automatically while you are
 *     logged in, without you having to remember anything.
 *  3. An IP allowlist in the environment. Covers every device on your
 *     network — a new phone, a browser you have never opened before,
 *     an incognito window — with nothing to set up on the device.
 *
 * Any one of the three is enough to drop the hit.
 */

export const OWNER_COOKIE = "cc_owner";

/** Two years. This should outlive laptops, not sessions. */
export const OWNER_MAX_AGE = 60 * 60 * 24 * 730;

export function ownerCookieOptions(on: boolean) {
  return {
    // Deliberately not httpOnly: the browser needs to read this to stop GA4.
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: on ? OWNER_MAX_AGE : 0,
  };
}

/**
 * IPs whose traffic is never counted. Set ANALYTICS_EXCLUDE_IPS in Vercel to a
 * comma-separated list — your home and office addresses, for instance.
 */
export function excludedIps(): string[] {
  return (process.env.ANALYTICS_EXCLUDE_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The visitor's real IP. Cloudflare sits in front of Vercel, so its header is
 * the authoritative one; the others are fallbacks for a direct deployment.
 */
export function clientIp(request: Request): string | null {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export function isExcludedIp(request: Request): boolean {
  const list = excludedIps();
  if (!list.length) return false;
  const ip = clientIp(request);
  return Boolean(ip && list.includes(ip));
}
