import { NextResponse } from "next/server";
import { createAppServerClient } from "@/lib/supabase/app";
import { OWNER_COOKIE, ownerCookieOptions, isOwnerEmail } from "@/lib/analytics/owner";

export const dynamic = "force-dynamic";

/**
 * Where Google sends the user back to.
 *
 * The code in the query string is exchanged for a session here, server-side,
 * so the tokens land in httpOnly cookies rather than passing through the page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=missing_code`);
  }

  const supabase = await createAppServerClient();
  if (!supabase) return NextResponse.redirect(`${origin}/signin?error=not_configured`);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/signin?error=${encodeURIComponent(error.message.slice(0, 120))}`,
    );
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  // Signing in is the moment we learn, on this device, that this is you
  // rather than a visitor. Every other exclusion is tied to a machine — a
  // cookie, an IP, a browser's localStorage — which is why checking the live
  // site from a phone kept landing in the numbers. This is tied to the
  // account, so it only has to happen once per device.
  if (isOwnerEmail(data?.user?.email)) {
    response.cookies.set(OWNER_COOKIE, "1", ownerCookieOptions(true));
  }

  return response;
}
