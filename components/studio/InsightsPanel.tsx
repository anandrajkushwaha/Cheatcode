"use client";

import Link from "next/link";
import { useState } from "react";
import { PanelRightIcon } from "@/components/studio/icons";

export type Insight = {
  id: string;
  kind: "trend" | "guide" | "tip";
  title: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  source: string;
  publishedAt: string | null;
  /**
   * The date, already formatted.
   *
   * Formatted on the server rather than here because this component renders
   * in both places: a date turned into text on the client can land on a
   * different day than the one the server rendered, and React reports that as
   * a hydration mismatch. One formatter, one timezone, one answer.
   */
  publishedLabel: string | null;
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
 * Cards open our own page rather than jumping straight to the publisher. That
 * is the deliberate choice: a card in a sidebar cannot carry enough of a story
 * to decide whether it is worth your time, and throwing someone onto another
 * site mid-conversation loses them. The page in between gives the excerpt room
 * and puts the way out where they can see it.
 *
 * The heading is Playfair Display bold italic, as drawn. It is the only
 * display type in the product, loaded through next/font so the file is served
 * from our own origin and no visitor's browser ever calls fonts.googleapis —
 * which is the rule Inter is self-hosted to satisfy, kept intact.
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
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-hidden rounded-studio-panel bg-studio-panel 2xl:w-[340px]">
      <div className="flex shrink-0 items-center justify-between px-5 pt-5">
        <h2 className="font-display text-[1.75rem] font-bold italic leading-none text-studio-accent">
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
        className="mx-5 mt-4 flex shrink-0 items-center gap-1 rounded-studio-card bg-paper p-2 shadow-studio-soft"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-studio-tab font-medium transition-colors ${
              tab === t.key ? "bg-studio-accent text-paper" : "text-ink-50 hover:text-ink-70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
        {shown.length === 0 ? (
          <p className="px-1 py-6 text-studio-note leading-relaxed text-ink-30">
            {items.length === 0
              ? "Nothing here yet. The feed fills itself a few times a day."
              : "Nothing under this filter."}
          </p>
        ) : (
          shown.map((item) => (
            <Link
              key={item.id}
              href={`/studio/insights/${item.id}`}
              className="block rounded-studio-card bg-paper px-4 py-3 transition-shadow hover:shadow-studio"
            >
              <p className="text-studio-card font-medium leading-snug text-ink-70">
                {item.title}
              </p>
              {item.summary && (
                <p className="mt-1 line-clamp-2 text-studio-note leading-relaxed text-ink-50">
                  {item.summary}
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-ink-30">
                <span className="truncate">{item.source}</span>
                {item.publishedLabel && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">{item.publishedLabel}</span>
                  </>
                )}
              </p>
            </Link>
          ))
        )}

        {items.length > 0 && (
          <Link
            href="/studio/insights"
            className="block px-1 pt-1 text-[0.8rem] font-medium text-studio-accent hover:underline"
          >
            View all
          </Link>
        )}
      </div>
    </aside>
  );
}
