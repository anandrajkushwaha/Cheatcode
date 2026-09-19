"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The four destinations, in a floating pill.
 *
 * The active state is a filled track that sits *behind* the label rather than
 * an underline beneath it, which is the one structural difference from the
 * marketing site's nav — and the reason this is a separate component instead
 * of a reuse of NavLink. Matching NavLink's underline here would have meant a
 * prop that changes what the component fundamentally is.
 */

export type StudioNavItem = {
  href: string;
  label: string;
  /**
   * Match this path exactly and nothing beneath it.
   *
   * Only Home needs it, and it needs it badly: every other destination is a
   * path under /studio, so a prefix match would light Home up on all of them.
   */
  exact?: boolean;
};

export const STUDIO_NAV: StudioNavItem[] = [
  { href: "/studio", label: "Home", exact: true },
  { href: "/studio/interviews", label: "Mock Interviews" },
  { href: "/studio/jobs", label: "Jobs" },
  { href: "/studio/counselling", label: "Career Counselling" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Studio"
      className="flex items-center gap-1 rounded-full border-2 border-paper bg-paper p-2 shadow-studio-soft"
    >
      {STUDIO_NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-6 py-2.5 text-studio-nav transition-colors ${
              active
                ? "bg-studio-rail font-semibold text-ink-70"
                : "font-normal text-studio-muted hover:text-ink-70"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
