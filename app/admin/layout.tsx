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

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/analytics", label: "Traffic" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/posts", label: "Articles" },
  { href: "/admin/queue", label: "Queue" },
  { href: "/admin/logs", label: "Publish log" },
  { href: "/admin/waitlist", label: "Waitlist" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layer 2 of the guard. proxy.ts already redirected, but this re-verifies
  // on every render so a stale or forged cookie can never render admin data.
  const store = await cookies();
  if (!verifySessionToken(store.get(ADMIN_COOKIE)?.value)) {
    redirect("/admin-login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink-08 bg-paper/90 backdrop-blur-xl">
        <div className="container-page flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-7">
            <Link href="/admin" className="text-[0.9rem] font-semibold tracking-[-0.04em]">
              Cheatcode <span className="text-ink-30">admin</span>
            </Link>
            <nav className="hidden gap-6 sm:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <LogoutButton />
        </div>
        <nav className="container-page flex gap-5 overflow-x-auto pb-3 sm:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap text-[0.8rem] text-ink-50"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="container-page py-10">{children}</main>
    </div>
  );
}
