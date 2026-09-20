import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE, readSession } from "@/lib/admin/auth";
import { canOpenPage, canCallApi, homeFor } from "@/lib/admin/roles";

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

  // ------------------------------------------------------------ admin API
  // Before the page guard, because /api/admin/* does not start with /admin
  // and would otherwise never be seen here at all. This is the wall: an
  // editor cannot call an owner's endpoint even with a hand-written fetch,
  // whatever the route handler itself remembers to check.
  if (pathname.startsWith("/api/admin/")) {
    // The login endpoint is how you get a session; it cannot require one.
    if (pathname !== "/api/admin/login") {
      const session = readSession(request.cookies.get(ADMIN_COOKIE)?.value);
      if (!session) {
        return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
      }
      if (!canCallApi(session.role, session.sections, pathname)) {
        return NextResponse.json(
          { ok: false, error: "Your account cannot do that." },
          { status: 403 },
        );
      }
    }
    return NextResponse.next();
  }

  // ---------------------------------------------------------------- admin
  if (pathname.startsWith("/admin")) {
    const session = readSession(request.cookies.get(ADMIN_COOKIE)?.value);
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin-login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }

    // Somebody typing a URL they were not given is sent to the first screen
    // they were — there is nothing they can do about the refusal, so a page
    // explaining it would only be a page.
    if (!canOpenPage(session.role, session.sections, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = homeFor(session.sections);
      url.search = "";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // --------------------------------------------------------------- studio
  // /studio was the old address of the signed-in shell. Links to it are out
  // in the world — bookmarks, emails, anything already shared — so they are
  // forwarded rather than 404'd. Runs before the /app guard so a signed-out
  // visitor lands on the new URL first and is asked to sign in there.
  if (pathname === "/studio" || pathname.startsWith("/studio/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/app" + pathname.slice("/studio".length);
    return NextResponse.redirect(url);
  }

  // ---------------------------------------------------------------- app
  // The signed-in shell. It is listed here rather than given a guard of its
  // own so there is exactly one place where "a signed-in area" is defined —
  // two copies of this block is how one of them ends up a refresh behind the
  // other.
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
  // /api/admin is listed explicitly: it does not start with /admin, so
  // without this line the API guard above would never run and the wall would
  // be a decoration.
  matcher: ["/admin/:path*", "/api/admin/:path*", "/app/:path*", "/studio/:path*"],
};
