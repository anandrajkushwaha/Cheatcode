import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";

/**
 * Next.js 16 renamed Middleware to Proxy. Same file-convention role,
 * root-level, Node.js runtime.
 *
 * Two guards live here, for two audiences:
 *
 *   /admin — you. A signed HMAC cookie, re-verified in the admin layout.
 *   /app   — your users. A Supabase session.
 *
 * The /app half also does something /admin does not need to: it refreshes the
 * Supabase access token. Server Components are not allowed to write cookies,
 * so if the refresh does not happen here it happens nowhere, and users get
 * silently signed out about once an hour.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---------------------------------------------------------------- admin
  if (pathname.startsWith("/admin")) {
    const ok = verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
    if (!ok) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin-login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ---------------------------------------------------------------- app
  if (pathname.startsWith("/app")) {
    const url =
      process.env.NEXT_PUBLIC_APP_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_APP_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    // Not configured yet: let the page render its own explanation rather than
    // bouncing to a sign-in screen that could not work either.
    if (!url || !key) return NextResponse.next();

    let response = NextResponse.next({ request });

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          // Written twice on purpose: to the request so this same pass sees the
          // fresh token, and to the response so the browser keeps it.
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // getUser(), not getSession(): this is a security decision, and the cookie
    // on its own is attacker-controlled. The call also triggers the refresh
    // whose cookies the handler above captures.
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/signin";
      redirect.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      return NextResponse.redirect(redirect);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/app/:path*"],
};
