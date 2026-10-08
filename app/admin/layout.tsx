import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { canOpenPage } from "@/lib/admin/roles";
import { currentAdmin } from "@/lib/admin/guard";
import { LogoutButton } from "./LogoutButton";
import { AdminNav } from "./AdminNav";
import { ExcludeThisDevice } from "@/components/admin/ExcludeThisDevice";

export const metadata: Metadata = {
  title: "Admin — Cheatcode",
  robots: { index: false, follow: false, nocache: true },
};

// Admin is never cached or statically rendered.
export const dynamic = "force-dynamic";

/**
 * Sixteen tabs do not fit across the top of a screen, so they are down the
 * side.
 *
 * They used to be one horizontal strip that scrolled sideways, which was fine
 * at seven and became unusable at sixteen: the last four were off the edge,
 * invisible, and reachable only by a drag nobody knew was there. A column
 * shows every one at once, scrolls on its own when the window is short, and
 * leaves the page itself scrolling independently.
 *
 * The strip is kept for narrow screens, where a 232px sidebar would be a
 * third of the width.
 *
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
  // The website: visitors, sources, ad campaigns and the free tools.
  { href: "/admin/traffic", label: "Traffic" },
  // Beside Traffic, and after it: Traffic counts arrivals, this one says
  // which of our pages they arrived at — and which they never do.
  { href: "/admin/pages", label: "Pages" },
  // Résumés before People, because the question "is the product being used"
  // comes before "by whom" — and the download count on the first tab is the
  // one number that says the answer is yes.
  { href: "/admin/resume", label: "Résumés" },
  // Beside Résumés because it is the same section's permission, and because
  // an unanswered one is somebody who paid and heard nothing.
  { href: "/admin/resume-requests", label: "Reviews queue" },
  { href: "/admin/users", label: "People" },
  // After People because it answers the next question: People says how many
  // signed up, this says who they are — read out of their own résumés.
  { href: "/admin/user-analytics", label: "User analytics" },
  // Next to People because it is the same list, filtered to the ones who
  // tried to pay — which is the only demand signal there is until checkout
  // exists.
  { href: "/admin/pro", label: "Pro interest" },
  // Next to Pro interest because it is the other half of the same page: one
  // tab counts who reached for the plan, this one edits what they read first.
  { href: "/admin/reviews", label: "Reviews" },
  // Next to Articles because it is the same job: pages written here that
  // exist to be found by somebody who has not heard of us yet.
  { href: "/admin/govt", label: "Government jobs" },
  { href: "/admin/bank", label: "Question bank" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/posts", label: "Articles" },
  // Beside Articles: the same kind of job, shorter.
  { href: "/admin/insights", label: "Insights" },
  // Last, and owner-only by virtue of not being a grantable section: this is
  // the screen that hands out the others.
  { href: "/admin/team", label: "Team" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  /**
   * Layer 2 of the guard, and the authoritative one.
   *
   * proxy.ts has already checked the cookie, which is fast and up to twelve
   * hours out of date. currentAdmin() re-reads the team member's permissions
   * from the database, so a section taken away — or an account switched off —
   * takes effect on the next page they open rather than tomorrow.
   */
  const session = await currentAdmin();
  if (!session) redirect("/admin-login");

  const { role, sections } = session;

  /**
   * The nav is filtered, not just the routes.
   *
   * An editor seeing six tabs they cannot open would be a worse screen than
   * one tab, and a link that redirects is a link that looked like a promise.
   * The proxy still refuses the URLs; this is what the screen shows.
   */
  const nav = NAV.filter((n) => canOpenPage(role, sections, n.href));

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <ExcludeThisDevice who={role === "owner" ? "owner" : `team ${session.uid}`} />

      <div className="flex">
        {/* The sidebar is its own scroll region: `sticky top-0` plus a full
            viewport height means a long nav scrolls inside itself while the
            page scrolls behind it, rather than the two fighting. */}
        <aside className="sticky top-0 hidden h-screen w-[14.5rem] shrink-0 flex-col border-r border-ink-08 bg-paper md:flex">
          <div className="px-4 py-4">
            <Link
              href={nav[0]?.href ?? "/admin"}
              className="block text-[0.9rem] font-semibold tracking-[-0.04em]"
            >
              Cheatcode <span className="text-ink-30">admin</span>
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
            <AdminNav items={nav} variant="sidebar" />
          </div>

          <div className="border-t border-ink-08 px-4 py-3">
            <LogoutButton />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Narrow screens keep the strip. One nav list, two renderings, so
              there is still only one place to add a link. */}
          <header className="sticky top-0 z-40 border-b border-ink-08 bg-paper/90 backdrop-blur-xl md:hidden">
            <div className="flex h-14 items-center justify-between gap-4 px-4">
              <div className="flex min-w-0 items-center gap-4">
                <Link
                  href={nav[0]?.href ?? "/admin"}
                  className="shrink-0 text-[0.9rem] font-semibold tracking-[-0.04em]"
                >
                  Cheatcode <span className="text-ink-30">admin</span>
                </Link>
                <AdminNav items={nav} variant="bar" />
              </div>
              <LogoutButton />
            </div>
          </header>

          <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
