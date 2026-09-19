"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  NewChatIcon,
  PanelLeftIcon,
  ToolsIcon,
} from "@/components/studio/icons";

export type RecentItem = { id: string; title: string };

const LINKS = [
  { href: "/studio/chat", label: "New Chat", Icon: NewChatIcon },
  { href: "/studio/resume", label: "Your Resume", Icon: DocumentIcon },
  { href: "/studio/tools", label: "Tools", Icon: ToolsIcon },
] as const;

/**
 * The left sidebar, in its two widths.
 *
 * Collapsed is not "the same sidebar, narrower" — it is a different component
 * state: labels go, the recent list goes, the user card becomes just the
 * avatar. Rendering both from one tree rather than two keeps the icons in the
 * same vertical positions across the transition, which is what makes the
 * collapse read as a fold rather than a swap.
 */
export function Sidebar({
  collapsed,
  onToggle,
  user,
  recents,
}: {
  collapsed: boolean;
  onToggle: () => void;
  user: { name: string; plan: string; avatarUrl: string | null };
  recents: RecentItem[];
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden rounded-studio-panel bg-studio-panel transition-[width] duration-300 ${
        collapsed ? "w-[76px]" : "w-[300px] xl:w-[340px]"
      }`}
    >
      <div className={collapsed ? "px-4 pt-4" : "px-4 pt-4"}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-10 items-center justify-center rounded-xl text-studio-accent transition-colors hover:bg-paper"
        >
          <PanelLeftIcon className="size-5" />
        </button>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col px-4">
        <ul className="space-y-1">
          {LINKS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={`flex items-center gap-2.5 rounded-studio-link px-3.5 py-3 text-studio-nav text-ink-70 transition-colors ${
                    active ? "bg-paper" : "hover:bg-paper/60"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon className="size-6 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <ChevronRightIcon className="size-5 shrink-0 text-ink-30" />
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {!collapsed && (
          <>
            <hr className="my-3 border-studio-line" />

            <div className="flex items-center justify-between px-3.5 py-2">
              <span className="text-studio-nav font-medium text-ink-70">Recent</span>
              <ChevronDownIcon className="size-5 text-ink-30" />
            </div>

            {/* The only scrolling region in the sidebar. The list grows without
                bound, so the user card below it must not be pushed off. */}
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {recents.length === 0 ? (
                <li className="px-3.5 py-1.5 text-studio-recent text-ink-30">
                  Nothing yet.
                </li>
              ) : (
                recents.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/studio/chat/${item.id}`}
                      className="block truncate rounded-lg px-3.5 py-1.5 text-studio-recent text-studio-muted transition-colors hover:text-ink-70"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </>
        )}

        {collapsed && <div className="flex-1" />}
      </div>

      <div className={`border-t border-studio-line ${collapsed ? "p-4" : "mx-4 px-2.5 py-4"}`}>
        <Link
          href="/studio/profile"
          className={`flex items-center gap-4 ${collapsed ? "justify-center" : ""}`}
        >
          <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-paper">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-[1rem] font-medium text-ink-50">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>

          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-studio-nav font-medium text-ink-70">
                {user.name}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[0.875rem]">
                <span className="text-ink-30">{user.plan}</span>
                <span className="text-studio-muted underline">Upgrade</span>
              </span>
            </span>
          )}

          {!collapsed && <ChevronRightIcon className="size-5 shrink-0 text-ink-30" />}
        </Link>
      </div>
    </aside>
  );
}
