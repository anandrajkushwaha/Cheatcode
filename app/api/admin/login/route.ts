import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  adminConfigured,
  createSessionToken,
  safeEqual,
  sessionCookieOptions,
} from "@/lib/admin/auth";
import { OWNER_COOKIE, ownerCookieOptions } from "@/lib/analytics/owner";

// Small in-memory throttle. Serverless instances are short-lived, so this is a
// speed bump rather than a wall — enough to make online guessing impractical.
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return Response.json(
      { ok: false, error: "Admin login is not configured on the server." },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.until > now && rec.n >= 8) {
    return Response.json(
      { ok: false, error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const userOk = safeEqual(String(body.username ?? ""), process.env.ADMIN_USERNAME!);
  const passOk = safeEqual(String(body.password ?? ""), process.env.ADMIN_PASSWORD!);

  if (!userOk || !passOk) {
    const next = rec && rec.until > now ? rec.n + 1 : 1;
    attempts.set(ip, { n: next, until: now + 5 * 60 * 1000 });
    // Deliberately vague: never reveal which field was wrong.
    return Response.json({ ok: false, error: "Wrong username or password." }, { status: 401 });
  }

  attempts.delete(ip);
  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionToken(), sessionCookieOptions());

  // Signing in is the clearest statement we will ever get that this browser is
  // yours. The admin session expires in 12 hours; this doesn't, so your
  // ordinary browsing of the live site stays out of the numbers as well.
  store.set(OWNER_COOKIE, "1", ownerCookieOptions(true));

  return Response.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
