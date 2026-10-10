import { createAppAdminClient, getSessionUser } from "@/lib/supabase/app";
import { sanitizeTouch } from "@/lib/analytics/attribution";

export const dynamic = "force-dynamic";

/**
 * Saves who ran the free ATS checker, signed in or not.
 *
 * The file itself is still read in the browser and never sent. What arrives
 * here is the contact block the checker found in it (lib/tools/contact.ts),
 * the score, and where the visit came from — so a free-check ad produces
 * leads in the admin panel (/admin/leads), not just a pixel event. The
 * uploader tells people this happens, and the privacy page says it too.
 *
 * Always answers 204: the person is looking at their score, and nothing
 * about saving a lead should ever show them an error.
 */

const hits = new Map<string, { n: number; until: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;

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

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim().slice(0, max);
  return s || null;
}

const done = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return done();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return done();
  }

  const email = str(body.email, 254)?.toLowerCase() ?? null;
  const phone = str(body.phone, 16);
  const row = {
    name: str(body.name, 80),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null,
    phone: phone && /^\+91[6-9]\d{9}$/.test(phone) ? phone : null,
    linkedin: str(body.linkedin, 200),
    score:
      typeof body.score === "number" && Number.isFinite(body.score)
        ? Math.max(0, Math.min(100, Math.round(body.score)))
        : null,
    file_type: str(body.fileType, 8),
    landing: str(body.landing, 120),
    in_app: body.inApp === true,
  };
  // A row with no way to reach anybody is not a lead.
  if (!row.email && !row.phone) return done();

  const db = createAppAdminClient();
  if (!db) return done();

  const touch = sanitizeTouch(body.touch);
  const user = await getSessionUser().catch(() => null);

  const { error } = await db.from("ats_leads").insert({
    ...row,
    user_id: user?.id ?? null,
    source: touch?.source ?? null,
    medium: touch?.medium ?? null,
    campaign: touch?.campaign ?? null,
  });
  if (error) console.error("[ats-lead] insert failed", error.message);
  return done();
}
