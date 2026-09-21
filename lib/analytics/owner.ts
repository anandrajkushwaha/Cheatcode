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
 *  4. Your signed-in identity. The three above are all per-device, and the
 *     gap they left was the obvious one: a phone on mobile data has no
 *     cookie, no admin session, and a carrier IP that changes hourly, so
 *     every time you checked the live site from it you were a visitor. This
 *     one follows you rather than the machine — sign in anywhere and that
 *     device stops being counted, permanently.
 *
 * Any one of the four is enough to drop the hit.
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

/* --------------------------------------------------------------- identity */

/**
 * The people whose browsing is never counted, by email address.
 *
 * Set ANALYTICS_OWNER_EMAILS to a comma-separated list. The admin username is
 * included automatically when it looks like an email, because somebody who
 * can sign in to the admin panel is by definition not a visitor.
 *
 * This is what makes the phone work. Signing in on a device sets the same
 * long-lived cookie the manual exclude URL sets, so it needs to happen once
 * per device and then never again.
 */
export function ownerEmails(): string[] {
  const listed = (process.env.ANALYTICS_OWNER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const admin = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  if (admin?.includes("@") && !listed.includes(admin)) listed.push(admin);

  return listed;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().includes(email.trim().toLowerCase());
}

/* ------------------------------------------------------ analytics-only list */

/**
 * Accounts that are never counted in analytics — and get nothing else.
 *
 * Separate from ownerEmails() on purpose. An owner email also lifts the AI
 * allowance (lib/app/allowance.ts) and changes how the agent treats the
 * account, so putting a team or test inbox there to hide it from GA would
 * quietly hand it unlimited paid usage. This list only stops the counting.
 *
 * Extend it with ANALYTICS_EXCLUDE_EMAILS (comma-separated) in Vercel.
 */
const ALWAYS_EXCLUDED_EMAILS = ["cheatcodeapp26@gmail.com"];

export function analyticsExcludedEmails(): string[] {
  const extra = (process.env.ANALYTICS_EXCLUDE_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...ALWAYS_EXCLUDED_EMAILS, ...extra, ...ownerEmails()])];
}

export function isAnalyticsExcludedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return analyticsExcludedEmails().includes(email.trim().toLowerCase());
}
