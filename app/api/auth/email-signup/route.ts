import { createAppAdminClient } from "@/lib/supabase/app";
import { parseIdentifier } from "@/lib/auth/identifier";

export const dynamic = "force-dynamic";

/**
 * Email-or-phone + password sign-up, with no confirmation step in between.
 *
 * Exists for people arriving from a Meta ad: Instagram and Facebook open the
 * site in their own browser, where Google refuses to sign anyone in, and SMS
 * codes are not configured. Email and a password work everywhere.
 *
 * The account is created here, server side, already confirmed, so the very
 * next step — the browser signing in with the same password — succeeds at
 * once. Waiting on a confirmation email from inside an Instagram webview is
 * where these sign-ups would otherwise die. The cost is that the address is
 * not proven to belong to the person; the resume and the account are theirs
 * alone, so the risk is a typo, not a takeover.
 *
 * A phone number is stored as the account's phone and also turned into a
 * login address on our own subdomain (see lib/auth/identifier.ts), because
 * Supabase only signs a phone in with a password when SMS is configured.
 *
 * Returns 201 when created, 409 when the address already has an account (the
 * form then asks for the existing password instead), 400 for bad input and
 * 429 when one address is hammering the endpoint.
 */

// Best effort: per serverless instance, not global. Enough to blunt a script
// hitting one warm instance; not a substitute for a real limiter.
const hits = new Map<string, { n: number; until: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;

function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.until < now) {
    hits.set(ip, { n: 1, until: now + WINDOW_MS });
    return false;
  }
  h.n += 1;
  return h.n > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) {
    return Response.json({ error: "Too many attempts. Wait a few minutes and try again." }, { status: 429 });
  }

  let body: { identifier?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const raw =
    typeof body.identifier === "string" ? body.identifier : typeof body.email === "string" ? body.email : "";
  const id = parseIdentifier(raw);
  const password = typeof body.password === "string" ? body.password : "";

  if (!id) {
    return Response.json(
      { error: "Enter an email address or a 10-digit Indian mobile number." },
      { status: 400 },
    );
  }
  if (password.length < 8 || password.length > 72) {
    return Response.json({ error: "Use a password of at least 8 characters." }, { status: 400 });
  }

  const admin = createAppAdminClient();
  if (!admin) {
    return Response.json({ error: "Sign-up isn't configured yet." }, { status: 503 });
  }

  const { error } = await admin.auth.admin.createUser({
    email: id.email,
    password,
    email_confirm: true,
    ...(id.kind === "phone" ? { phone: id.phone, phone_confirm: true } : {}),
    user_metadata: { signup_method: id.kind },
  });

  if (error) {
    if (/already been registered|already registered|already exists|duplicate/i.test(error.message)) {
      return Response.json({ exists: true }, { status: 409 });
    }
    return Response.json({ error: "Couldn't create the account. Try again in a moment." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
