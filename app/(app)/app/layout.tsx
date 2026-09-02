import Link from "next/link";
import { redirect } from "next/navigation";
import { NavLink } from "@/components/app/NavLink";
import { AgentOrb } from "@/components/app/AgentOrb";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/app";
import { appAuthConfigured } from "@/lib/supabase/app-env";
import { getProfile, isPaid } from "@/lib/app/account";

export const metadata: Metadata = {
  title: "Cheatcode",
  // The signed-in product is not for search engines. Every page behind this
  // layout inherits it, so a new page cannot leak into Google by omission.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/app", label: "Home" },
  // Exact, because the builder lives underneath it and both would light up.
  { href: "/app/resume", label: "Resume", exact: true },
  { href: "/app/resume/builder", label: "Builder" },
  { href: "/app/jobs", label: "Jobs" },
  { href: "/app/agent", label: "Agent" },
  { href: "/app/profile", label: "Profile" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!appAuthConfigured) {
    return (
      <main className="container-page flex min-h-screen items-center justify-center">
        <div className="max-w-lg rounded-2xl border border-ink-30 p-7">
          <h1 className="text-[1.1rem] font-semibold">Accounts aren&apos;t connected yet</h1>
          <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-50">
            Add these to your environment, then run{" "}
            <code className="font-mono text-ink">supabase/schemas/20_app_accounts.sql</code> in
            that project:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-ink-04 p-4 font-mono text-[0.75rem] leading-relaxed">
{`NEXT_PUBLIC_APP_SUPABASE_URL=
NEXT_PUBLIC_APP_SUPABASE_PUBLISHABLE_KEY=
APP_SUPABASE_SECRET_KEY=`}
          </pre>
          <p className="mt-4 text-[0.82rem] leading-relaxed text-ink-30">
            Leave them unset to reuse the website&apos;s existing Supabase project instead — the
            code falls back to it.
          </p>
        </div>
      </main>
    );
  }

  // The proxy already redirected, but this re-checks on every render. Two
  // layers, because a guard that lives only in middleware is one config
  // change away from being no guard at all.
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/app");

  const profile = await getProfile();
  const paid = isPaid(profile);
  const name = profile?.full_name ?? user.email ?? profile?.phone ?? "your account";

  return (
    <div className="min-h-screen">
      {/* `no-print` here rather than a selector in the stylesheet: the resume
          builder prints the page it is on, and the nav bar is not part of
          anybody's resume. Marking it where it is written means a new piece of
          chrome cannot quietly start appearing in somebody's printout. */}
      <header className="no-print sticky top-0 z-40 border-b border-ink-08 bg-paper/90 backdrop-blur-xl">
        <div className="container-app flex h-14 items-center justify-between gap-6">
          <div className="flex items-center gap-7">
            <Link href="/app" className="text-[0.9rem] font-semibold tracking-[-0.04em]">
              Cheatcode
            </Link>
            <nav className="hidden items-center gap-6 sm:flex">
              {NAV.map((n) => (
                <NavLink key={n.href} href={n.href} label={n.label} exact={n.exact} />
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {!paid && (
              <Link
                href="/app/upgrade"
                className="btn-premium rounded-full px-3.5 py-1.5 text-[0.78rem] font-semibold"
              >
                Upgrade
              </Link>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-[0.8rem] text-ink-30 transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="container-app flex gap-5 overflow-x-auto pb-3 sm:hidden">
          {NAV.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} exact={n.exact} />
          ))}
        </nav>
      </header>

      <main className="container-app py-8 sm:py-10">{children}</main>

      {/* Outside main so it never inherits a page's padding or stacking
          context — a fixed element inside a transformed ancestor stops being
          fixed, and that bug only shows up on the one page that animates. */}
      <AgentOrb />

      <footer className="no-print container-app mt-12 border-t border-ink-08 py-8 pb-28 text-[0.78rem] text-ink-30 sm:pb-8">
        Signed in as {name}.{" "}
        <Link href="/" className="underline underline-offset-4 hover:text-ink">
          Back to the site
        </Link>
      </footer>
    </div>
  );
}
