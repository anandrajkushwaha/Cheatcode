import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";

/**
 * Next.js 16 renamed Middleware to Proxy. Same file-convention role,
 * root-level, Node.js runtime.
 *
 * This is layer 1 of the admin guard — a fast redirect for a nicer UX.
 * The real enforcement is in app/admin/layout.tsx and the API routes,
 * which re-verify on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const ok = verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
    if (!ok) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin-login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
