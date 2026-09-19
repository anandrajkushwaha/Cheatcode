"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AgentOrb } from "@/components/app/AgentOrb";

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
  { href: "/studio/jobs", label: "Jobs" },
  { href: "/studio/interviews", label: "Mock Interviews" },
  { href: "/studio/resume", label: "Resume" },
  { href: "/studio/tools", label: "Free Tools" },
];

export function TopBar({
  user,
}: {
  user: { name: string; avatarUrl: string | null };
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-08 bg-paper">
      <div className="mx-auto flex h-[72px] max-w-[1120px] items-center gap-6 px-4 sm:px-6">
        <Link
          href="/studio"
          className="shrink-0 text-[1.35rem] font-semibold tracking-[-0.04em] text-ink sm:text-[1.6rem]"
        >
          Cheatcode
        </Link>

        {/* Scrolls sideways under its own width rather than pushing the
            wordmark off a narrow screen. */}
        <nav
          aria-label="Studio"
          className="flex min-w-0 flex-1 items-center gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {STUDIO_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap text-[0.95rem] transition-colors ${
                  active ? "font-medium text-ink" : "text-ink-50 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <AgentOrb placement="inline" />

          <Link
            href="/studio/profile"
            aria-label="Your profile"
            className="relative size-9 overflow-hidden rounded-full bg-ink-04 ring-1 ring-ink-08"
          >
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt="" fill sizes="36px" className="object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-[0.85rem] font-medium text-ink-50">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
