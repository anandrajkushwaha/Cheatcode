"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A date-range calendar for the admin screens, in a popover under whatever
 * opened it: two months side by side (one on a phone), tap the first day,
 * tap the last, Apply. Days are Indian calendar days as YYYY-MM-DD, both
 * ends included; nothing after `max` (today) can be picked.
 *
 * Built here rather than <input type="date"> because the browser's own
 * picker looks different on every machine and nothing like the rest of the
 * panel.
 */

const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T00:00:00Z`);
const addMonths = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
const pretty = (s: string) => SHORT.format(parse(s));

function monthDays(first: Date): (string | null)[] {
  const start = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(start).fill(null);
  for (let d = 1; d <= days; d++) cells.push(ymd(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), d))));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function DateRangeCalendar({
  from: initialFrom,
  to: initialTo,
  max,
  onApply,
  onClose,
  align = "left",
}: {
  from: string;
  to: string;
  max: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
  align?: "left" | "right";
}) {
  const [from, setFrom] = useState<string | null>(initialFrom);
  const [to, setTo] = useState<string | null>(initialTo);
  const [hover, setHover] = useState<string | null>(null);
  // The right-hand month is the one holding the end of the range.
  const [right, setRight] = useState(() => {
    const d = parse(initialTo || max);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  });
  const left = addMonths(right, -1);
  const lastMonth = useMemo(() => {
    const d = parse(max);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }, [max]);

  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // On the next tick, so the click that opened it does not close it.
    const t = setTimeout(() => document.addEventListener("mousedown", away), 0);
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  function pick(day: string) {
    if (!from || (from && to)) {
      setFrom(day);
      setTo(null);
    } else if (day < from) {
      setTo(from);
      setFrom(day);
    } else setTo(day);
  }

  // While choosing the end, the range follows the pointer.
  const end = to ?? (from && hover && hover >= from ? hover : null);
  const inRange = (d: string) => !!from && !!end && d > from && d < end;

  // A plain function, not a component: re-rendering on hover must not remount the days.
  function month(first: Date) {
    return (
      <div className="w-[15.5rem]">
        <p className="text-center text-[0.84rem] font-semibold">{MONTH.format(first)}</p>
        <div className="mt-3 grid grid-cols-7 text-center text-[0.66rem] uppercase tracking-[0.08em] text-ink-30">
          {WEEK.map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {monthDays(first).map((d, i) => {
            if (!d) return <span key={i} />;
            const disabled = d > max;
            const isStart = d === from;
            const isEnd = d === end;
            const between = inRange(d);
            const isToday = d === max;
            return (
              <div
                key={d}
                className={`relative h-9 ${between ? "bg-[#9be15d]/25" : ""} ${isStart && end && end !== from ? "rounded-l-full bg-[#9be15d]/25" : ""} ${
                  isEnd && from && end !== from ? "rounded-r-full bg-[#9be15d]/25" : ""
                }`}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(d)}
                  onMouseEnter={() => setHover(d)}
                  className={`relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[0.8rem] tabular-nums transition-colors ${
                    isStart || isEnd
                      ? "bg-ink font-semibold text-paper"
                      : disabled
                        ? "cursor-not-allowed text-ink-15"
                        : "text-ink hover:bg-ink-04"
                  } ${isToday && !isStart && !isEnd ? "ring-1 ring-ink-30" : ""}`}
                >
                  {Number(d.slice(8))}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={box}
      role="dialog"
      aria-label="Choose dates"
      className={`absolute top-full z-50 mt-2 rounded-2xl border border-ink-08 bg-paper p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.3)] ${
        align === "right" ? "right-0" : "left-0"
      } animate-[calIn_160ms_ease-out]`}
    >
      <div className="relative flex gap-6">
        <button
          type="button"
          onClick={() => setRight((r) => addMonths(r, -1))}
          aria-label="Previous month"
          className="absolute left-0 top-0 rounded-full p-1.5 text-ink-50 hover:bg-ink-04 hover:text-ink"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setRight((r) => (r < lastMonth ? addMonths(r, 1) : r))}
          disabled={right >= lastMonth}
          aria-label="Next month"
          className="absolute right-0 top-0 rounded-full p-1.5 text-ink-50 hover:bg-ink-04 hover:text-ink disabled:opacity-30"
        >
          ›
        </button>
        <div className="hidden sm:block">
          {month(left)}
        </div>
        {month(right)}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-08 pt-3">
        <p className="text-[0.78rem] text-ink-50">
          {from ? (
            <>
              <span className="font-medium text-ink">{pretty(from)}</span>
              {" – "}
              <span className={to ? "font-medium text-ink" : "text-ink-30"}>{to ? pretty(to) : "pick the last day"}</span>
            </>
          ) : (
            "Pick the first day"
          )}
          <span className="ml-2 text-ink-30">· India time</span>
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-3.5 py-1.5 text-[0.78rem] text-ink-50 hover:bg-ink-04 hover:text-ink">
            Cancel
          </button>
          <button
            type="button"
            disabled={!from || !to}
            onClick={() => from && to && onApply(from, to)}
            className="rounded-full bg-ink px-4 py-1.5 text-[0.78rem] font-medium text-paper transition-opacity disabled:opacity-30"
          >
            Apply
          </button>
        </div>
      </div>
      <style>{`@keyframes calIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
