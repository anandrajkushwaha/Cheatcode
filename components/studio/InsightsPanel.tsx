"use client";

import { useState } from "react";
import { PanelRightIcon } from "@/components/studio/icons";

export type Insight = {
  id: string;
  kind: "trend" | "guide" | "tip";
  title: string;
  summary: string;
  href?: string;
};

const TABS = [
  { key: "all", label: "All" },
  { key: "trend", label: "Trend" },
  { key: "guide", label: "Guide" },
  { key: "tips", label: "Tips" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const MATCHES: Record<TabKey, (i: Insight) => boolean> = {
  all: () => true,
  trend: (i) => i.kind === "trend",
  guide: (i) => i.kind === "guide",
  tips: (i) => i.kind === "tip",
};

/**
 * The right-hand panel.
 *
 * Filtering happens here rather than on the server because the whole set is
 * small and already in the page — a round trip to hide three cards would be
 * slower than the animation it replaced.
 *
 * The heading is set in the body font rather than the Playfair Display the
 * design calls for. That is a deliberate hold, not an oversight: the site
 * self-hosts exactly one family so that no page makes a third-party font
 * request, and a second display face is a real decision about page weight,
 * not something to smuggle in through a panel header.
 */
export function InsightsPanel({
  items,
  onHide,
}: {
  items: Insight[];
  onHide: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("all");
  const shown = items.filter(MATCHES[tab]);

  return (
    <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-studio-panel bg-studio-panel">
      <div className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-[1.6rem] font-semibold italic tracking-[-0.02em] text-studio-accent">
          Insights
        </h2>
        <button
          type="button"
          onClick={onHide}
          aria-label="Hide insights"
          className="flex size-9 items-center justify-center rounded-xl text-studio-accent transition-colors hover:bg-paper"
        >
          <PanelRightIcon className="size-5" />
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Filter insights"
        className="mx-5 mt-4 flex items-center gap-1 rounded-studio-card bg-paper p-2 shadow-studio-soft"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-studio-tab font-medium transition-colors ${
              tab === t.key
                ? "bg-studio-accent text-paper"
                : "text-ink-50 hover:text-ink-70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {shown.length === 0 ? (
          <p className="px-1 py-6 text-studio-note leading-relaxed text-ink-30">
            Nothing here yet.
          </p>
        ) : (
          shown.map((item) => {
            const body = (
              <>
                <p className="text-studio-card font-medium leading-snug text-ink-70">
                  {item.title}
                </p>
                <p className="mt-1 text-studio-note leading-relaxed text-ink-50">
                  {item.summary}
                </p>
              </>
            );

            return item.href ? (
              <a
                key={item.id}
                href={item.href}
                className="block rounded-studio-card bg-paper px-4 py-3 transition-shadow hover:shadow-studio-soft"
              >
                {body}
              </a>
            ) : (
              <div
                key={item.id}
                className="rounded-studio-card bg-paper px-4 py-3"
              >
                {body}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
