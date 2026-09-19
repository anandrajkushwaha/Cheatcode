"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TopNav } from "@/components/studio/TopNav";
import { Sidebar, type RecentItem } from "@/components/studio/Sidebar";
import { InsightsPanel, type Insight } from "@/components/studio/InsightsPanel";
import { PanelLeftIcon, PanelRightIcon } from "@/components/studio/icons";
import { persistLayout, type StudioLayout } from "@/lib/studio/layout-state";

/**
 * The studio's frame: header, three columns, tinted ground.
 *
 * ------------------------------------------------------------ the height
 *
 * The root is a fixed viewport (h-dvh) with overflow hidden, and every region
 * that can grow scrolls inside it. This is the whole reason the composer used
 * to slide off the bottom of the screen and the user card used to get pushed
 * out of the sidebar: with a min-height root, a long list of conversations
 * simply made the page taller than the window, and `flex-1 overflow-auto`
 * inside it had no ceiling to push against. Now it does.
 *
 * dvh rather than vh because on a phone the address bar's collapse changes
 * the usable height, and vh would leave the composer a browser chrome's worth
 * below the fold for as long as the bar is showing.
 *
 * ------------------------------------------------------------ the columns
 *
 * Three widths, three shapes:
 *   under lg  — one column. The sidebar becomes a drawer over the page,
 *               because 280px of a 390px screen is not a sidebar.
 *   lg to xl  — sidebar and canvas. Insights steps out; squeezing three
 *               columns in here leaves the middle one a gutter.
 *   xl and up — all three, as drawn.
 *
 * The collapse preference survives all of this. Narrow the window until the
 * panel is dropped and widen it again, and it comes back as you left it.
 */
export function StudioShell({
  initial,
  user,
  recents,
  insights,
  children,
}: {
  initial: StudioLayout;
  user: { name: string; plan: string; avatarUrl: string | null };
  recents: RecentItem[];
  insights: Insight[];
  children: React.ReactNode;
}) {
  const [layout, setLayout] = useState<StudioLayout>(initial);

  /**
   * The drawer is not the same thing as the sidebar's collapsed state, and
   * conflating them was tempting. A phone opening the drawer must not mean
   * the desktop sidebar is expanded the next time you sit down — so this one
   * is local, transient, and never written to the cookie.
   */
  const [drawer, setDrawer] = useState(false);

  const update = useCallback((patch: Partial<StudioLayout>) => {
    setLayout((prev) => {
      const next = { ...prev, ...patch };
      persistLayout(next);
      return next;
    });
  }, []);

  // Escape closes the drawer. A panel that covers the page and traps you is
  // worse than no panel.
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gradient-to-b from-studio-bg-1 to-studio-bg-2">
      <header className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-4 sm:gap-4 sm:px-6 lg:gap-6 lg:px-8 lg:pb-4 lg:pt-7">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-studio-accent transition-colors hover:bg-paper lg:hidden"
        >
          <PanelLeftIcon className="size-5" />
        </button>

        <Link
          href="/studio"
          className="shrink-0 text-[1.25rem] font-semibold tracking-[-0.04em] text-ink sm:text-[1.5rem] lg:text-[2rem]"
        >
          Cheatcode
        </Link>

        <div className="flex min-w-0 flex-1 justify-center">
          <TopNav />
        </div>

        {/* Nothing in the design restores the Insights panel once it is
            hidden, which would strand anyone who closed it. This is the way
            back, and it only exists while the panel is gone and there is a
            window wide enough to put it back into. */}
        <div className="hidden w-[140px] shrink-0 justify-end xl:flex">
          {!layout.insights && (
            <button
              type="button"
              onClick={() => update({ insights: true })}
              aria-label="Show insights"
              className="flex size-10 items-center justify-center rounded-xl text-studio-accent transition-colors hover:bg-paper"
            >
              <PanelRightIcon className="size-5" />
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-4 pb-4 sm:px-6 lg:gap-4 lg:px-8 lg:pb-7">
        <div className="hidden lg:flex">
          <Sidebar
            collapsed={!layout.sidebar}
            onToggle={() => update({ sidebar: !layout.sidebar })}
            user={user}
            recents={recents}
          />
        </div>

        <main
          id="main"
          className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-studio-panel bg-studio-canvas"
        >
          {children}
        </main>

        {layout.insights && (
          <div className="hidden xl:flex">
            <InsightsPanel
              items={insights}
              onHide={() => update({ insights: false })}
            />
          </div>
        )}
      </div>

      {/* The drawer. Rendered only while open so the sidebar's scroll position
          and its Recent fold start fresh each time, and so nothing offscreen
          is holding a scroll container on a phone. */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 w-[min(84vw,300px)] p-3">
            <Sidebar
              collapsed={false}
              onToggle={() => setDrawer(false)}
              onNavigate={() => setDrawer(false)}
              user={user}
              recents={recents}
            />
          </div>
        </div>
      )}
    </div>
  );
}
