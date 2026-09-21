"use client";

import Link from "next/link";
import { useState } from "react";
import type { Insight } from "@/lib/insights/query";

/**
 * The Insights panel in the home screen's right rail, as designed: a serif
 * heading, All / Trend / Tips, and the three newest items for that tab.
 *
 * Every item opens the reader at that story; "View all" opens it at the top.
 * The tabs only filter what is already here — switching them is instant and
 * costs no request.
 */
/** The design sets this heading in a serif italic; Georgia is the one every
 *  device already has, so it costs no font download. */
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";

const TABS = [
  { key: "all", label: "All" },
  { key: "trend", label: "Trend" },
  { key: "guide", label: "Tips" },
] as const;

export function InsightsCard({ items }: { items: Insight[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  if (items.length === 0) return null;

  const shown = items.filter((i) => tab === "all" || i.category === tab).slice(0, 3);

  return (
    <section className="rounded-2xl border border-ink-08 bg-[#fcfaee] p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 style={{ fontFamily: SERIF }} className="text-[1.55rem] font-bold italic leading-none tracking-[-0.01em] text-[#121224]">
          Insights
        </h2>
        <Link
          href="/app/insights"
          className="text-[0.86rem] font-semibold text-[#1f5bff] hover:underline"
        >
          View all
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Insight type"
        className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-paper p-1 shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg py-1.5 text-[0.78rem] transition-colors ${
              tab === t.key ? "bg-[#16162a] font-medium text-white" : "text-ink-50 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul className="mt-3.5 space-y-2.5">
        {shown.length === 0 && (
          <li className="rounded-xl border border-[#efe9cf] bg-paper px-3.5 py-3 text-[0.76rem] text-ink-50">
            Nothing in this tab today.
          </li>
        )}
        {shown.map((i) => (
          <li key={i.id}>
            <Link
              href={`/app/insights?id=${i.id}`}
              className="block rounded-xl border border-[#efe9cf] bg-paper px-3.5 py-3 transition-colors hover:border-[#dcd3a8]"
            >
              <p className="line-clamp-2 text-[0.86rem] font-medium leading-snug text-[#2b2b33]">
                {i.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[0.71rem] leading-relaxed text-ink-50">
                {i.summary}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
