"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Nav with a state, because the product has five destinations and a header
 * that never changes leaves you guessing which one you are on. The underline
 * is drawn on a pseudo-element so the label does not shift by a pixel when it
 * becomes active.
 */
export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  // "/app" must not light up on "/app/jobs", but "/app/jobs/123" must.
  const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative whitespace-nowrap py-1 text-[0.85rem] transition-colors ${
        active ? "text-ink" : "text-ink-50 hover:text-ink"
      }`}
    >
      {label}
      <span
        className={`absolute -bottom-0.5 left-0 h-px w-full origin-left bg-ink transition-transform duration-300 ${
          active ? "scale-x-100" : "scale-x-0"
        }`}
      />
    </Link>
  );
}
