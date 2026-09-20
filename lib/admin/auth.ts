import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export const ADMIN_COOKIE = "cc_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

/**
 * Who is signed in.
 *
 *   owner  — everything. One person.
 *   editor — writes and publishes articles. Nothing else, anywhere.
 *
 * The role is inside the signed token rather than looked up afterwards, so
 * there is no moment between "this cookie is valid" and "this person is an
 * editor" where a request is treated as trusted-but-unclassified. A token
 * that verifies always says what it is allowed to do.
 */
export type AdminRole = "owner" | "editor";

const ROLES: readonly AdminRole[] = ["owner", "editor"];

function isRole(v: string): v is AdminRole {
  return (ROLES as readonly string[]).includes(v);
}

function secret() {
  return process.env.ADMIN_SESSION_SECRET ?? "";
}

/** Constant-time string compare that doesn't leak length through early exit. */
export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still do a compare so timing stays flat.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export type AdminSession = {
  role: AdminRole;
  /** The admin_users row, for a team member. Empty for the owner. */
  uid: string;
  /** Which sections they may reach. Ignored for the owner, who may reach all. */
  sections: string[];
};

/**
 * token = <expiryMs>.<role>.<uid>.<sections>.<nonce>.<hmac>
 *
 * Everything the guards need is inside the signature, so checking a request
 * costs no database call — which matters because the proxy runs on every
 * single admin request, including the ones that are only fetching an image.
 *
 * The cost of that choice is staleness: a permission removed here is still in
 * a token already issued. So the screens and the API routes re-check against
 * the database, where removal is immediate, and the token is only trusted for
 * the cheap first pass. See lib/admin/guard.ts.
 *
 * Tokens from the older formats no longer verify. Everybody signs in once
 * more, which is the correct outcome — an old token carries no sections and
 * there is no safe default to invent for it.
 */
export function createSessionToken(session: AdminSession): string {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const nonce = randomBytes(12).toString("hex");
  // Sections are comma-joined; the names are [a-z] by construction, so there
  // is nothing in them that could break the dot-separated format.
  const payload = `${exp}.${session.role}.${session.uid || "-"}.${session.sections.join(",") || "-"}.${nonce}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** The session behind a cookie, or null. Null means "not signed in" — always. */
export function readSession(token: string | undefined): AdminSession | null {
  if (!token || !secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 6) return null;

  const [expStr, role, uid, sections, nonce, sig] = parts;
  const expected = createHmac("sha256", secret())
    .update(`${expStr}.${role}.${uid}.${sections}.${nonce}`)
    .digest("hex");
  if (!safeEqual(sig, expected)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return null;
  if (!isRole(role)) return null;

  return {
    role,
    uid: uid === "-" ? "" : uid,
    sections: sections === "-" ? [] : sections.split(",").filter(Boolean),
  };
}

/**
 * Valid session of any role.
 *
 * Kept for the handful of callers that only ask "is this our own browser" —
 * analytics exclusion, mostly. Anything that grants access to data or an
 * action must use readSession and check the role instead, which is why this
 * returns a bare boolean and always will.
 */
export function verifySessionToken(token: string | undefined): boolean {
  return readSession(token) !== null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function adminConfigured() {
  return Boolean(
    process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET,
  );
}
