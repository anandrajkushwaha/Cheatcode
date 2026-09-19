"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { TopNav } from "@/components/studio/TopNav";
import { Sidebar, type RecentItem } from "@/components/studio/Sidebar";
import { InsightsPanel, type Insight } from "@/components/studio/InsightsPanel";
import { PanelRightIcon } from "@/components/studio/icons";
import {
  persistLayout,
  type StudioLayout,
} from "@/lib/studio/layout-state";

/**
 * The studio's frame: header, three columns, tinted ground.
 *
 * State lives here rather than in each panel because the two panels are not
 * independent — the middle column's width is a function of both, and a layout
 * where each side owns its own flag is a layout where the middle column has
 * to guess. One object, one writer.
 *
 * `initial` comes from the cookie the server already read, so the first paint
 * is the user's real layout. Every toggle writes it straight back; there is no
 * effect watching state and syncing afterwards, because that pattern fires on
 * mount too and would rewrite the cookie on every page load for no reason.
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

  const update = useCallback((patch: Partial<StudioLayout>) => {
    setLayout((prev) => {
      const next = { ...prev, ...patch };
      persistLayout(next);
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-studio-bg-1 to-studio-bg-2">
      <header className="flex items-center gap-6 px-8 pb-4 pt-8">
        <Link
          href="/studio"
          className="text-[2rem] font-semibold tracking-[-0.04em] text-ink"
        >
          Cheatcode
        </Link>

        <div className="flex flex-1 justify-center">
          <TopNav />
        </div>

        {/* Nothing in the design restores the Insights panel once it is
            hidden, which would strand anyone who closed it. This is the way
            back, and it only exists while the panel is gone. */}
        <div className="flex w-[180px] justify-end">
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

      <div className="flex min-h-0 flex-1 gap-4 px-8 pb-8">
        <Sidebar
          collapsed={!layout.sidebar}
          onToggle={() => update({ sidebar: !layout.sidebar })}
          user={user}
          recents={recents}
        />

        <main
          id="main"
          className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-studio-panel bg-studio-canvas"
        >
          {children}
        </main>

        {/* Below 1280px there is not enough width for three columns without
            squeezing the middle one into a gutter, so the panel steps out.
            The preference is kept — widen the window and it returns. */}
        {layout.insights && (
          <div className="hidden xl:flex">
            <InsightsPanel
              items={insights}
              onHide={() => update({ insights: false })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
