import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin/auth";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = {
  title: "Admin — Cheatcode",
  robots: { index: false, follow: false, nocache: true },
};

// Admin is never cached or statically rendered.
export const dynamic = "force-dynamic";

/**
 * Two screens, and a door back to the articles.
 *
 * This used to be seven tabs — traffic, content, schedule, articles, jobs,
 * waitlist, and an overview summarising all of them. Every one answered a
 * question about the website. None answered the one that decides whether the
 * product works: which feature people actually use, what serving them costs,
 * and whether the thing it produced was any use to them.
 *
 * So the tabs are Dashboard and Settings. Articles stays because it is how the
 * blog gets written, and deleting it would take a working publishing workflow
 * away in order to tidy a navigation bar.
 */
const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/posts", label: "Articles" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Layer 2 of the guard. proxy.ts already redirected, but this re-verifies on
  // every render so a stale or forged cookie can never render admin data.
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) {
    redirect("/admin-login");
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-40 border-b border-ink-08 bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link href="/admin" className="shrink-0 text-[0.9rem] font-semibold tracking-[-0.04em]">
              Cheatcode <span className="text-ink-30">admin</span>
            </Link>
            {/* One nav that scrolls sideways on a phone, rather than a second
                copy of itself underneath — two lists meant two places to
                forget to add a link. */}
            <nav className="flex min-w-0 gap-1 overflow-x-auto">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.82rem] text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink sm:px-3"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
