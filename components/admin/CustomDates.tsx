"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * A custom date range for a screen whose presets are plain links
 * (/admin/journeys). Dates are Indian calendar days, both ends included;
 * lib/admin/range.ts turns them into the period read. Other query values
 * (the source filter) ride along unchanged.
 */
export function CustomDates({
  basePath,
  active,
  from: initialFrom,
  to: initialTo,
  today,
  keep = {},
}: {
  basePath: string;
  active: boolean;
  from: string;
  to: string;
  /** Today in India, YYYY-MM-DD — the latest day that can be picked. */
  today: string;
  keep?: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const bad = !from || !to || from > to;

  const pretty = (d: string) =>
    new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

  function apply() {
    if (bad) return;
    const q = new URLSearchParams({ ...keep, range: "custom", from, to });
    setOpen(false);
    router.push(`${basePath}?${q.toString()}`);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`rounded-full px-3.5 py-1.5 text-[0.8rem] transition-colors ${
          active ? "bg-ink text-paper" : "border border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
        }`}
      >
        📅 {active ? (initialFrom === initialTo ? pretty(initialFrom) : `${pretty(initialFrom)} – ${pretty(initialTo)}`) : "Custom dates"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[17rem] rounded-xl border border-ink-15 bg-paper p-4 text-[0.82rem] shadow-xl">
          <label className="block text-[0.72rem] uppercase tracking-[0.08em] text-ink-30">
            From
            <input
              type="date"
              value={from}
              max={to || today}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink-15 px-2.5 py-1.5 text-[0.85rem] normal-case tracking-normal text-ink outline-none focus:border-ink-30"
            />
          </label>
          <label className="mt-3 block text-[0.72rem] uppercase tracking-[0.08em] text-ink-30">
            To
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink-15 px-2.5 py-1.5 text-[0.85rem] normal-case tracking-normal text-ink outline-none focus:border-ink-30"
            />
          </label>
          <p className="mt-2 text-[0.72rem] text-ink-30">Both days included. India time.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-ink-15 py-1.5 text-ink-70 hover:border-ink-30"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={bad}
              className="flex-1 rounded-lg bg-ink py-1.5 text-paper disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
