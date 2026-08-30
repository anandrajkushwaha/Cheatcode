"use client";

import Link from "next/link";
import { useState } from "react";
import { RANGES, type Range } from "@/lib/admin/range";

/**
 * The range control shared by every dashboard screen.
 *
 * The presets are plain links so the page stays a server component and a range
 * is shareable as a URL. Only the custom-dates panel needs state, so only that
 * part is interactive.
 */
export function RangePicker({ basePath, range }: { basePath: string; range: Range }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(range.from?.slice(0, 10) ?? today);
  const [to, setTo] = useState(
    range.to ? new Date(new Date(range.to).getTime() - 864e5).toISOString().slice(0, 10) : today,
  );

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {RANGES.map((r) => (
        <Link
          key={r.id}
          href={`${basePath}?range=${r.id}`}
          className={`rounded-full px-3.5 py-1.5 text-[0.78rem] transition-colors ${
            range.id === r.id ? "bg-ink text-paper" : "border border-ink-15 text-ink-50 hover:text-ink"
          }`}
        >
          {r.label}
        </Link>
      ))}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`rounded-full px-3.5 py-1.5 text-[0.78rem] transition-colors ${
          range.id === "custom" ? "bg-ink text-paper" : "border border-ink-15 text-ink-50 hover:text-ink"
        }`}
      >
        {range.id === "custom" ? range.label : "Custom"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[19rem] rounded-2xl border border-ink-15 bg-paper p-4 shadow-lg">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">From</span>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-ink-15 px-2.5 py-1.5 text-[0.82rem]"
              />
            </label>
            <label className="block">
              <span className="text-[0.7rem] uppercase tracking-[0.12em] text-ink-30">To</span>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-ink-15 px-2.5 py-1.5 text-[0.82rem]"
              />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[0.72rem] text-ink-30">Both days included · IST</span>
            <Link
              href={`${basePath}?range=custom&from=${from}&to=${to}`}
              onClick={() => setOpen(false)}
              className="rounded-full bg-ink px-4 py-1.5 text-[0.78rem] text-paper"
            >
              Apply
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
