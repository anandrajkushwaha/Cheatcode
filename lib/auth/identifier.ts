/**
 * What someone typed into "Email or phone number", made into an account key.
 *
 * Shared by the sign-in form and the sign-up route so both read the same
 * input the same way. Pure: no imports, safe in the browser and on the server.
 *
 * A phone number signs in with a password, not an SMS code: SMS is not set
 * up, and Supabase only lets a phone sign in with a password when an SMS
 * provider is configured. So a number is stored on the account as its phone
 * AND turned into an address on a subdomain we own, which is what the
 * password is checked against. Nothing is ever sent to that address — the
 * account is created already confirmed, and the person only ever sees and
 * types their number.
 */

export const PHONE_LOGIN_DOMAIN = "phone.cheatcodeapp.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Identifier =
  | { kind: "email"; email: string; display: string }
  | { kind: "phone"; phone: string; email: string; display: string };

/** Indian numbers as people type them: "98765 43210", "+91 98765-43210", "919876543210". */
function toE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits.slice(1))) {
    return `+91${digits.slice(1)}`;
  }
  return null;
}

export function phoneLoginEmail(e164: string): string {
  return `${e164.replace(/\D/g, "")}@${PHONE_LOGIN_DOMAIN}`;
}

export function parseIdentifier(raw: string): Identifier | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes("@")) {
    const email = value.toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return null;
    // The phone subdomain is ours; nobody should sign up with it directly.
    if (email.endsWith(`@${PHONE_LOGIN_DOMAIN}`)) return null;
    return { kind: "email", email, display: email };
  }
  const phone = toE164(value);
  if (!phone) return null;
  const d = phone.slice(3);
  return {
    kind: "phone",
    phone,
    email: phoneLoginEmail(phone),
    display: `+91 ${d.slice(0, 5)} ${d.slice(5)}`,
  };
}
