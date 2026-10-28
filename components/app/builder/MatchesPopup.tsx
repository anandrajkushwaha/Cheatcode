"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EVENTS, track } from "@/lib/analytics/events";

/**
 * After the resume downloads: how many open jobs genuinely fit it.
 *
 * The moment somebody has a finished resume is the moment they are about to
 * leave — the resume was the whole errand. This turns it into the start of
 * one: real postings, scored against what they just wrote (lib/jobs/match.ts).
 * Nothing is shown when nothing genuinely fits; an empty promise is worse
 * than no popup.
 */

type Top = { id: string; title: string; company: string; where: string; score: number; matched: string[] };

export function MatchesPopup({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<{ count: number; top: Top[] } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/app/jobs/matches")
      .then((r) => r.json())
      .then((j: { ok?: boolean; count?: number; top?: Top[] }) => {
        if (!live) return;
        if (!j.ok || !j.count) return onClose();
        setData({ count: j.count, top: j.top ?? [] });
        track(EVENTS.BUILDER_STEP, { label: "matches_shown", count: j.count });
      })
      .catch(() => live && onClose());
    return () => {
      live = false;
    };
  }, [onClose]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative w-full rounded-t-[1.75rem] bg-paper p-6 shadow-2xl sm:max-w-[30rem] sm:rounded-[1.75rem] sm:p-8">
        <p className="text-[0.8rem] font-medium text-[#1a7f37]">✓ Resume downloaded</p>
        <h2 className="mt-2 text-[1.5rem] font-semibold leading-tight tracking-[-0.03em]">
          Your resume fits {data.count} open {data.count === 1 ? "job" : "jobs"}
        </h2>
        <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-50">
          Matched on the skills and experience you just wrote. Here are the closest:
        </p>

        <ul className="mt-5 space-y-2.5">
          {data.top.map((j) => (
            <li key={j.id}>
              <Link
                href={`/app/jobs/${j.id}/apply`}
                onClick={() => track(EVENTS.BUILDER_STEP, { label: "matches_job_click", score: j.score })}
                className="flex items-center justify-between gap-3 rounded-2xl border border-ink-08 p-3.5 transition-colors hover:border-ink-30"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.9rem] font-medium">{j.title}</span>
                  <span className="block truncate text-[0.78rem] text-ink-50">
                    {j.company} · {j.where}
                    {j.matched.length ? ` · ${j.matched.join(", ")}` : ""}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-[#e7f6ec] px-2.5 py-1 text-[0.76rem] font-semibold tabular-nums text-[#1a7f37]">
                  {j.score}%
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/app/jobs?for=me"
          onClick={() => track(EVENTS.BUILDER_STEP, { label: "matches_all_click", count: data.count })}
          className="mt-6 flex w-full items-center justify-center rounded-full bg-ink px-5 py-3.5 text-[0.92rem] font-medium text-paper transition-opacity hover:opacity-90"
        >
          See all {data.count} matching jobs →
        </Link>
        <button type="button" onClick={onClose} className="mt-3 w-full text-[0.82rem] text-ink-30 hover:text-ink">
          Later
        </button>
      </div>
    </div>
  );
}
