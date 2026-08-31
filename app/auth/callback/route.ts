import { NextResponse } from "next/server";
import { createAppServerClient } from "@/lib/supabase/app";

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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/signin?error=${encodeURIComponent(error.message.slice(0, 120))}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
