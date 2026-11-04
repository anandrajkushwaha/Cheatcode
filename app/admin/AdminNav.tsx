"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** `group` heads a run of links in the sidebar (Growth, Users, Revenue…). */
export type NavItem = { href: string; label: string; group?: string };

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
/** One small line icon per screen (24-unit, stroked), keyed by route. */
const ICONS: Record<string, string> = {
  "/admin": "M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 9h8V3h-8z",
  "/admin/traffic": "M3 17l6-6 4 4 8-8M15 7h6v6",
  "/admin/journeys": "M4 6h16M4 12h10M4 18h7M18 15l3 3-3 3",
  "/admin/pages": "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  "/admin/emails": "M3 6h18v12H3zM3 7l9 6 9-6",
  "/admin/users": "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 11a3 3 0 100-6M22 21a6 6 0 00-4-5.6",
  "/admin/leads": "M5 3h14v18l-7-4-7 4zM9 9h6M9 13h4",
  "/admin/user-analytics": "M4 20V10M10 20V4M16 20v-7M22 20H2",
  "/admin/match-popup": "M2 7h20v12H2zM2 11h20M6 15h4",
  "/admin/pro": "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z",
  "/admin/resume": "M6 3h9l4 4v14H6zM9 12h6M9 16h6M9 8h3",
  "/admin/resume-requests": "M4 5h16v11H8l-4 4zM8 10h8",
  "/admin/ai": "M12 3v3M12 18v3M3 12h3M18 12h3M7 7h10v10H7zM10 10h4v4h-4z",
  "/admin/posts": "M4 20h4L19 9l-4-4L4 16zM13 7l4 4",
  "/admin/insights": "M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z",
  "/admin/govt": "M3 21h18M4 10h16M12 3l9 5H3zM6 10v8M10 10v8M14 10v8M18 10v8",
  "/admin/bank": "M4 4h11a3 3 0 013 3v13H7a3 3 0 01-3-3zM4 17a3 3 0 013-3h11",
  "/admin/reviews": "M12 17l-5 3 1.3-5.7L4 10.5l5.8-.5L12 4.7l2.2 5.3 5.8.5-4.3 3.8L17 20z",
  "/admin/settings": "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H3a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 002.9-1.2V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  "/admin/team": "M16 21v-2a4 4 0 00-8 0v2M12 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6",
};

function Icon({ href, on }: { href: string; on: boolean }) {
  const d = ICONS[href];
  if (!d) return <span className="size-4" />;
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-[1.05rem] shrink-0 transition-colors ${on ? "text-[#9be15d]" : "text-ink-30 group-hover:text-ink"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

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
      {items.map((n, i) => (
        <div key={n.href}>
          {n.group && n.group !== items[i - 1]?.group && (
            <p className={`px-3 pb-1.5 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-ink-30 ${i === 0 ? "pt-1" : "pt-5"}`}>
              {n.group}
            </p>
          )}
          <Link
            href={n.href}
            aria-current={current(n.href) ? "page" : undefined}
            className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.84rem] transition-all duration-200 ${
              current(n.href)
                ? "bg-ink font-medium text-paper shadow-[0_6px_16px_-8px_rgba(0,0,0,0.5)]"
                : "text-ink-70 hover:bg-ink-04 hover:text-ink"
            }`}
          >
            <Icon href={n.href} on={current(n.href)} />
            {n.label}
          </Link>
        </div>
      ))}
    </nav>
  );
}
