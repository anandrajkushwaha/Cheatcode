"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { DateRangeCalendar } from "@/components/admin/DateRangeCalendar";
import { RANGES, istDay, istLastDay, type Range } from "@/lib/admin/range";

/**
 * The range control shared by every dashboard screen: a segmented switch
 * (Today · 24 hours · 7 days · 28 days · 90 days · Custom) whose white thumb
 * slides to the choice, and a calendar under Custom.
 *
 * A choice is still a URL (?range=…, shareable), but it is pushed inside a
 * transition: the screen stays put, the chosen pill shows it is loading, and
 * the numbers swap when they are ready instead of the page blanking out.
 * `keep` carries any other query values (a source filter) along.
 */
const FMT = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const short = (d: string) => FMT.format(new Date(`${d}T00:00:00Z`));

export function RangePicker({
  basePath,
  range,
  keep = {},
}: {
  basePath: string;
  range: Range;
  keep?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string>(range.id);
  const [open, setOpen] = useState(false);
  const today = istDay(new Date());
  const from = range.id === "custom" && range.from ? istDay(range.from) : istDay(new Date(Date.now() - 6 * 864e5));
  const to = range.id === "custom" ? istLastDay(range) : today;

  function go(q: Record<string, string>, id: string) {
    setChosen(id);
    const params = new URLSearchParams({ ...keep, ...q });
    start(() => router.push(`${basePath}?${params.toString()}`, { scroll: false }));
  }

  const items = [
    ...RANGES.map((r) => ({ id: r.id as string, label: r.label })),
    { id: "custom", label: range.id === "custom" ? (from === to ? short(from) : `${short(from)} – ${short(to)}`) : "Custom" },
  ];
  const active = pending ? chosen : range.id;

  // The thumb sits under the active pill, measured.
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = track.current?.querySelector<HTMLElement>(`[data-range="${active}"]`);
      if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, range.label]);

  return (
    <div className="relative inline-block max-w-full">
      <div ref={track} className="relative flex max-w-full overflow-x-auto rounded-full bg-ink-04 p-1 [scrollbar-width:none]">
        {thumb && (
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 rounded-full bg-paper shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ left: thumb.x, width: thumb.w }}
          />
        )}
        {items.map((it) => {
          const on = it.id === active;
          const loading = pending && it.id === chosen;
          return (
            <button
              key={it.id}
              type="button"
              data-range={it.id}
              aria-pressed={on}
              onClick={() => {
                if (it.id === "custom") return setOpen((v) => !v);
                if (it.id !== range.id) go({ range: it.id }, it.id);
              }}
              className={`relative z-10 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.78rem] font-medium transition-colors duration-200 ${
                on ? "text-ink" : "text-ink-50 hover:text-ink"
              }`}
            >
              {it.id === "custom" && (
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="2" y="3" width="12" height="11" rx="2" />
                  <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
                </svg>
              )}
              {it.label}
              {loading && <span aria-hidden="true" className="size-3 animate-spin rounded-full border-[1.5px] border-ink-15 border-t-ink" />}
            </button>
          );
        })}
      </div>

      {open && (
        <DateRangeCalendar
          from={from}
          to={to}
          max={today}
          onClose={() => setOpen(false)}
          onApply={(f, t) => {
            setOpen(false);
            go({ range: "custom", from: f, to: t }, "custom");
          }}
        />
      )}
    </div>
  );
}
