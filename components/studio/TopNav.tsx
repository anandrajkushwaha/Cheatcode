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
    /* Scrolls sideways under its own width rather than pushing the wordmark
       off the header. On a phone all four destinations do not fit at any
       readable size, and a nav that wraps to two rows costs more height than
       the screen has to give. */
    <nav
      aria-label="Studio"
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border-2 border-paper bg-paper p-1.5 shadow-studio-soft [scrollbar-width:none] lg:p-2 [&::-webkit-scrollbar]:hidden"
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
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[0.95rem] transition-colors sm:px-5 lg:px-6 lg:py-2.5 lg:text-studio-nav ${
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
