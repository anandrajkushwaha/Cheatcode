"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/**
 * The admin's own navigation, in two shapes.
 *
 * It is a client component for one reason: knowing which screen you are on.
 * Sixteen links in a column is a list you lose your place in, and the server
 * cannot tell which one is current without threading the pathname through
 * every page. One `usePathname` here is cheaper than that, and the highlight
 * is what makes a sidebar readable at all.
 *
 * "/admin" is matched exactly. As a prefix it is the start of every other
 * route, so the Dashboard link would be highlighted on all sixteen screens —
 * the same trap the permissions code documents, in a different place.
 */
export function AdminNav({ items, variant }: { items: NavItem[]; variant: "sidebar" | "bar" }) {
  const pathname = usePathname() ?? "";

  const current = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "bar") {
    return (
      <nav className="flex min-w-0 gap-1 overflow-x-auto">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[0.82rem] transition-colors sm:px-3 ${
              current(n.href) ? "bg-ink-04 text-ink" : "text-ink-50 hover:bg-ink-04 hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={current(n.href) ? "page" : undefined}
          className={`rounded-lg px-3 py-2 text-[0.84rem] transition-colors ${
            current(n.href)
              ? "bg-ink text-paper"
              : "text-ink-50 hover:bg-ink-04 hover:text-ink"
          }`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
