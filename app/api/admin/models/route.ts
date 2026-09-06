import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { listModels } from "@/lib/app/model-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What each provider key can actually reach.
 *
 * Its own endpoint rather than part of the settings page render, because it
 * makes two upstream calls that can each be slow or down, and a settings page
 * that will not load because OpenAI is having a morning is a settings page you
 * cannot use to move off OpenAI.
 *
 * Admin cookie, checked here. A route handler is its own entry point, and this
 * one confirms which providers a deployment has keys for — which is not
 * secret, but is nobody's business but the operator's.
 */
export async function GET(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) {
    return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  // `?refresh=1` skips the ten-minute cache, for the minute after somebody
  // adds a key and wants to see it take.
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  try {
    return Response.json({ ok: true, ...(await listModels(refresh)) });
  } catch (e) {
    console.error("admin/models:", e);
    return Response.json({ ok: false, error: "Could not list models." }, { status: 500 });
  }
}
