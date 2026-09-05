import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { cleanFlags, flagsNow, saveFlags } from "@/lib/app/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The settings screen's one write.
 *
 * The admin cookie is verified here rather than relied on from the layout: a
 * route handler is its own entry point, and "the page that calls it is behind
 * a guard" is not a guard. This is the one endpoint in the product that can
 * change which model every user's agent runs on, so it gets its own check.
 *
 * The body is rebuilt by `cleanFlags` before it reaches the database. Behind
 * an admin cookie is a much smaller threat than the open internet, but these
 * values end up in a URL and a request body sent to a paid API, and "the admin
 * panel is trusted" is how a typo becomes an outage nobody can explain.
 */
async function guard(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

export async function GET() {
  if (!(await guard())) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  return Response.json({ ok: true, flags: await flagsNow() });
}

export async function POST(request: Request) {
  if (!(await guard())) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  let body: { flags?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that request." }, { status: 400 });
  }

  try {
    const next = cleanFlags(body.flags);
    await saveFlags(next, typeof body.note === "string" ? body.note : undefined);
    return Response.json({ ok: true, flags: next });
  } catch (e) {
    console.error("admin/flags:", e);
    const message = e instanceof Error ? e.message : "That didn't save.";
    return Response.json(
      {
        ok: false,
        error: /feature_flags|does not exist|schema cache/i.test(message)
          ? "Run supabase/schemas/61_admin_tracking.sql first — the table isn't there yet."
          : message,
      },
      { status: 500 },
    );
  }
}
