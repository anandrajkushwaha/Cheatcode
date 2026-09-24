"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/studio/Avatar";

/**
 * The top bar.
 *
 * Four destinations, and deliberately not the same four the design carried.
 * "Resume Templates" became "Resume": templates are one screen inside a flow
 * that also has an upload, a score and a builder, and naming the bar after
 * one of them is how the audit found three separate destinations for a single
 * job. The bar points at the flow; the flow decides which screen you land on.
 */

export const STUDIO_NAV = [
  // Same page as the wordmark. Two ways to the same place is deliberate: the
  // logo is where people who know the convention click, the tab is for
  // everybody else.
  { href: "/app", label: "Home" },
  { href: "/app/jobs", label: "Jobs" },
  { href: "/app/interviews", label: "Mock Interviews" },
  { href: "/app/resume", label: "Resume" },
  { href: "/app/insights", label: "Insights" },
  { href: "/app/tools", label: "Free Tools" },
];

export function TopBar({
  user,
}: {
  user: { name: string; avatarUrl: string | null };
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-08 bg-paper">
      {/* Three tracks rather than a flex row: the outer two take the leftover
          space equally, which is what puts the nav on the page's centre line
          instead of merely between the wordmark and the avatar. */}
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-4 px-4 py-2.5 sm:h-[68px] sm:flex-nowrap sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-6 sm:py-0">
        <Link
          href="/app"
          className="justify-self-start text-[1.25rem] font-semibold tracking-[-0.04em] text-ink sm:text-[1.45rem]"
        >
          Cheatcode
        </Link>

        {/* Scrolls sideways under its own width rather than pushing the
            wordmark off a narrow screen. */}
        {/* On a phone this is its own full-width row under the wordmark: in
            the middle of a three-column grid it had about 115px for six
            links, with no sign that it scrolled. */}
        <nav
          aria-label="Studio"
          className="order-last -mx-4 flex w-screen min-w-0 items-center gap-6 overflow-x-auto border-t border-ink-08 px-4 py-2.5 [scrollbar-width:none] sm:order-none sm:mx-0 sm:w-auto sm:justify-center sm:border-0 sm:px-0 sm:py-0 [&::-webkit-scrollbar]:hidden"
        >
          {STUDIO_NAV.map((item) => {
            // Home is exact: every screen lives under /app, so a prefix match
            // would light it up everywhere.
            const active =
              item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap py-1.5 text-[0.88rem] transition-colors ${
                  active ? "font-medium text-ink" : "text-ink-50 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* The orb used to sit here. It now lives in the bottom-right corner,
            where a thing you summon belongs — beside the avatar it read as
            one more piece of chrome, and pressing it made the whole screen
            grow out of the top of the page. */}
        <div className="flex items-center justify-end gap-3 justify-self-end">
          {/* A plain form, not a fetch: the route answers with a 303 to the
              home page, and letting the browser follow it clears the session
              and the page in one step. */}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
          <Link href="/app/profile" aria-label="Your profile" className="shrink-0">
            <Avatar name={user.name} url={user.avatarUrl} size={36} className="ring-1 ring-ink-08" />
          </Link>
        </div>
      </div>
    </header>
  );
}
