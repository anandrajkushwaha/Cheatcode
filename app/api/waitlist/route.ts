import { createPublicClient } from "@/lib/supabase/public";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Body = {
  email?: unknown;
  source?: unknown;
  // Honeypot — real users never fill this; bots do.
  company?: unknown;
};

export async function POST(request: Request) {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid request." },
      { status: 400 },
    );
  }

  // Silently accept honeypot hits so bots don't learn anything.
  if (typeof body.company === "string" && body.company.length > 0) {
    return Response.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const source = typeof body.source === "string" ? body.source.slice(0, 64) : "unknown";

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return Response.json(
      { ok: false, error: "That email doesn't look right." },
      { status: 400 },
    );
  }

  const supabase = createPublicClient();

  if (!supabase) {
    // Fail loudly rather than pretending we captured the lead.
    console.error(
      "[waitlist] Supabase env vars missing — signup NOT saved:",
      email,
    );
    return Response.json(
      { ok: false, error: "Signups aren't live yet. Try again shortly." },
      { status: 503 },
    );
  }

  // No .select() here on purpose. Chaining it would ask PostgREST to read the
  // row back, and this table deliberately has no SELECT grant for the public
  // key — so the read-back would fail and roll the whole insert back.
  const { error } = await supabase.from("waitlist").insert({ email, source });

  if (error) {
    // 23505 = unique violation. Already on the list is a success, not an error.
    if (error.code === "23505") {
      return Response.json({ ok: true, alreadyOnList: true });
    }
    console.error("[waitlist] insert failed:", error.message);
    return Response.json(
      { ok: false, error: "Couldn't save that. Try again in a moment." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
