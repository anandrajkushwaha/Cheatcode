"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
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

/**
 * New Chat points at /studio, not at a route of its own.
 *
 * The home screen *is* the new chat — the greeting and the composer are the
 * empty state of a conversation, not a landing page in front of one. A
 * separate /studio/chat would have been a second door into the same room,
 * and the two would have drifted the first time either changed.
 */
const LINKS = [
  { href: "/studio", label: "New Chat", Icon: NewChatIcon, exact: true },
  { href: "/studio/resume", label: "Your Resume", Icon: DocumentIcon },
  { href: "/studio/tools", label: "Tools", Icon: ToolsIcon },
];

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  user,
  recents,
}: {
  collapsed: boolean;
  onToggle: () => void;
  /** Closes the drawer on narrow screens, where the sidebar sits over the page. */
  onNavigate?: () => void;
  user: { name: string; plan: string; avatarUrl: string | null };
  recents: RecentItem[];
}) {
  const pathname = usePathname();

  /**
   * Recent folds on its own, and folding it does not fold the sidebar.
   *
   * These were one control at first and that was wrong: someone with sixty
   * conversations wants the list out of the way and the three destinations
   * above it still visible. Two independent states, one chevron each.
   *
   * Not persisted, unlike the sidebar itself — this is a "get this out of my
   * way for a minute" gesture rather than a standing preference.
   */
  const [recentOpen, setRecentOpen] = useState(true);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden rounded-studio-panel bg-studio-panel transition-[width] duration-300 ${
        collapsed ? "w-[76px]" : "w-[280px] xl:w-[320px]"
      }`}
    >
      <div className="shrink-0 px-4 pt-4">
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

      <div className="mt-2 flex min-h-0 flex-1 flex-col px-3">
        <ul className="shrink-0 space-y-1">
          {LINKS.map(({ href, label, Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
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
            <hr className="my-3 shrink-0 border-studio-line" />

            <button
              type="button"
              onClick={() => setRecentOpen((v) => !v)}
              aria-expanded={recentOpen}
              aria-controls="studio-recent"
              className="flex shrink-0 items-center justify-between rounded-lg px-3.5 py-2 text-left transition-colors hover:bg-paper/60"
            >
              <span className="text-studio-nav font-medium text-ink-70">Recent</span>
              <ChevronDownIcon
                className={`size-5 text-ink-30 transition-transform duration-200 ${
                  recentOpen ? "" : "-rotate-90"
                }`}
              />
            </button>

            {/* The one scrolling region in the sidebar. It is allowed to grow
                into whatever space is left and no further, so the user card
                below can never be pushed off the bottom of the screen — which
                is exactly what happened when this was a plain list. */}
            {recentOpen && (
              <ul
                id="studio-recent"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
              >
                {recents.length === 0 ? (
                  <li className="px-3.5 py-1.5 text-studio-recent text-ink-30">
                    Nothing yet.
                  </li>
                ) : (
                  recents.map((item) => {
                    const href = `/studio/chat/${item.id}`;
                    return (
                      <li key={item.id}>
                        <Link
                          href={href}
                          onClick={onNavigate}
                          title={item.title}
                          aria-current={pathname === href ? "page" : undefined}
                          className={`block truncate rounded-lg px-3.5 py-1.5 text-studio-recent transition-colors hover:bg-paper/60 hover:text-ink-70 ${
                            pathname === href ? "text-ink-70" : "text-studio-muted"
                          }`}
                        >
                          {item.title}
                        </Link>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </>
        )}

        {/* Holds the card down when there is no list above it to do the job. */}
        {(collapsed || !recentOpen) && <div className="flex-1" />}
      </div>

      <div
        className={`shrink-0 border-t border-studio-line ${
          collapsed ? "p-4" : "mx-3 px-2.5 py-4"
        }`}
      >
        <Link
          href="/studio/profile"
          onClick={onNavigate}
          className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}
        >
          <span className="relative size-11 shrink-0 overflow-hidden rounded-full bg-paper">
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} alt="" fill sizes="44px" className="object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-[1rem] font-medium text-ink-50">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>

          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[1.05rem] font-medium text-ink-70">
                {user.name}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[0.85rem]">
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
