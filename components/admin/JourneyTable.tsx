"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Journey } from "@/lib/admin/journeys-build";

/**
 * The visits as a sheet: one row each, a filter on every column header.
 *
 * Tap a header's ▾ to pick values the way a spreadsheet filter works —
 * search, tick, select all, clear — and the rows narrow at once, in the
 * browser, with no reload. Filters on different columns combine. Tap a row
 * to open every page and step of that visit underneath it.
 */

const TIME = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string | null): string {
  if (!code) return "Unknown";
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function duration(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function offset(from: string, at: string) {
  return `+${duration(Math.max(0, Math.round((Date.parse(at) - Date.parse(from)) / 1000)))}`;
}

function spent(j: Journey) {
  if (j.seconds <= 0) return "—";
  if (j.seconds < 30) return "Under 30s";
  if (j.seconds < 120) return "30s–2m";
  if (j.seconds < 600) return "2–10m";
  return "10m+";
}

type Col = {
  id: string;
  label: string;
  /** The value the filter lists and matches on. */
  value: (j: Journey) => string;
  /** What the cell shows, when it differs from the filter value. */
  cell?: (j: Journey) => string;
  className?: string;
};

export function JourneyTable({ journeys, steps, outcomes }: { journeys: Journey[]; steps: string[]; outcomes: string[] }) {
  const cols: Col[] = useMemo(
    () => [
      { id: "time", label: "Time", value: (j) => DAY.format(new Date(j.startedAt)), cell: (j) => TIME.format(new Date(j.startedAt)), className: "whitespace-nowrap text-ink-50 tabular-nums" },
      { id: "country", label: "Country", value: (j) => countryName(j.country) },
      { id: "city", label: "City", value: (j) => j.city ?? "Unknown" },
      { id: "os", label: "Phone", value: (j) => j.os ?? "Unknown" },
      { id: "browser", label: "Browser", value: (j) => j.browser ?? "Unknown" },
      { id: "source", label: "Source", value: (j) => j.source ?? "Unknown" },
      { id: "landing", label: "Landed on", value: (j) => j.landing, className: "max-w-[14rem] truncate" },
      { id: "outcome", label: "Outcome", value: (j) => outcomes[j.furthest] ?? "?" },
      { id: "pages", label: "Pages", value: (j) => String(j.pages), className: "text-right tabular-nums" },
      { id: "spent", label: "Time spent", value: spent, cell: (j) => (j.seconds > 0 ? duration(j.seconds) : "—"), className: "text-right tabular-nums text-ink-50" },
    ],
    [outcomes],
  );

  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [open, setOpen] = useState<{ id: string; x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // A row passes when every filtered column holds one of its picked values.
  const rows = useMemo(
    () => journeys.filter((j) => cols.every((c) => !filters[c.id] || filters[c.id].has(c.value(j)))),
    [journeys, cols, filters],
  );
  const active = Object.keys(filters).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[0.78rem] text-ink-50">
        <span className="tabular-nums">
          Showing {rows.length} of {journeys.length}
        </span>
        {active > 0 && (
          <>
            {Object.entries(filters).map(([id, set]) => (
              <span key={id} className="rounded-full bg-ink-04 px-2.5 py-0.5 text-ink">
                {cols.find((c) => c.id === id)?.label}: {set.size === 1 ? [...set][0] : `${set.size} picked`}
              </span>
            ))}
            <button type="button" onClick={() => setFilters({})} className="underline underline-offset-4 hover:text-ink">
              Clear all filters
            </button>
          </>
        )}
      </div>

      <div className="min-h-[70vh] overflow-x-auto rounded-xl border border-ink-08">
        <table className="w-full min-w-[60rem] text-[0.82rem]">
          <thead className="bg-ink-04">
            <tr>
              {cols.map((c) => (
                <th key={c.id} className="relative px-3 py-2 text-left font-medium">
                  <button
                    type="button"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setOpen(open?.id === c.id ? null : { id: c.id, x: r.left, y: r.bottom + 4 });
                    }}
                    className={`flex items-center gap-1 whitespace-nowrap text-[0.72rem] uppercase tracking-[0.08em] ${
                      filters[c.id] ? "text-ink" : "text-ink-50 hover:text-ink"
                    }`}
                  >
                    {c.label}
                    <span aria-hidden className={filters[c.id] ? "text-[#1f6fe0]" : ""}>
                      {filters[c.id] ? "●" : "▾"}
                    </span>
                  </button>
                  {open?.id === c.id && (
                    <FilterMenu
                      at={open}
                      values={journeys.map(c.value)}
                      picked={filters[c.id] ?? null}
                      onClose={() => setOpen(null)}
                      onChange={(set) =>
                        setFilters((f) => {
                          const next = { ...f };
                          if (set) next[c.id] = set;
                          else delete next[c.id];
                          return next;
                        })
                      }
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-3 py-8 text-center text-ink-50">
                  No visits match these filters.
                </td>
              </tr>
            )}
            {rows.map((j) => (
              <Fragment key={j.session}>
                <tr
                  onClick={() => setExpanded(expanded === j.session ? null : j.session)}
                  className={`cursor-pointer border-t border-ink-08 hover:bg-ink-04 ${expanded === j.session ? "bg-ink-04" : ""}`}
                >
                  {cols.map((c) => (
                    <td key={c.id} className={`px-3 py-2 ${c.className ?? ""}`}>
                      {c.id === "outcome" ? (
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[0.72rem] ${
                            j.furthest >= 3 ? "bg-ink text-paper" : "border border-ink-15 text-ink-50"
                          }`}
                        >
                          {c.value(j)}
                        </span>
                      ) : (
                        (c.cell ?? c.value)(j)
                      )}
                    </td>
                  ))}
                </tr>
                {expanded === j.session && (
                  <tr>
                    <td colSpan={cols.length} className="bg-ink-04 px-4 pb-4 pt-1 text-[0.8rem]">
                      <p className="text-ink-50">
                        {j.source ?? "unknown source"}
                        {j.campaign ? ` · ${j.campaign}` : ""} · {j.device ?? "?"} · landed on {j.landing}
                      </p>
                      <ol className="mt-3 space-y-1.5">
                        {j.timeline.map((t, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="w-14 shrink-0 text-right text-ink-30 tabular-nums">{offset(j.startedAt, t.at)}</span>
                            <span className={t.kind === "page" ? "text-ink-50" : "font-medium"}>
                              {t.kind === "page" ? `Opened ${t.text}` : t.text}
                            </span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-3 text-[0.72rem] text-ink-30">Steps reached: {j.reached.map((i) => steps[i]).join(" → ")}</p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The spreadsheet-style value picker under a column header. */
function FilterMenu({
  at,
  values,
  picked,
  onChange,
  onClose,
}: {
  at: { x: number; y: number };
  values: string[];
  picked: Set<string> | null;
  onChange: (set: Set<string> | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");

  const options = useMemo(() => {
    const count = new Map<string, number>();
    for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [values]);
  const shown = options.filter(([v]) => v.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // Enter applies, like a spreadsheet filter.
    const enter = (e: KeyboardEvent) => e.key === "Enter" && applyRef.current();
    // Fixed to where the header was; scrolling would leave it behind.
    const scroll = (e: Event) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    document.addEventListener("keydown", enter);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      document.removeEventListener("keydown", enter);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [onClose]);

  // Ticks are a draft: nothing changes in the table until Apply, so several
  // values can be picked in one go.
  const [draft, setDraft] = useState<Set<string> | null>(picked);
  const isOn = (v: string) => !draft || draft.has(v);
  const toggle = (v: string) => {
    const next = new Set(draft ?? options.map(([o]) => o));
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setDraft(next.size === options.length ? null : next);
  };
  const apply = () => {
    onChange(draft);
    onClose();
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;

  return (
    <div
      ref={ref}
      style={{ left: Math.max(8, Math.min(at.x, (typeof window === "undefined" ? 9999 : window.innerWidth) - 264)), top: at.y }}
      className="fixed z-50 w-64 rounded-xl border border-ink-15 bg-paper p-3 text-[0.8rem] font-normal normal-case tracking-normal text-ink shadow-xl"
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search"
        className="w-full rounded-lg border border-ink-15 px-2.5 py-1.5 outline-none focus:border-ink-30"
      />
      <div className="mt-2 flex gap-3 text-[0.74rem]">
        <button type="button" onClick={() => setDraft(null)} className="text-[#1f6fe0] hover:underline">
          Select all
        </button>
        <button type="button" onClick={() => setDraft(new Set())} className="text-[#1f6fe0] hover:underline">
          Clear
        </button>
        {q && shown.length > 0 && (
          <button type="button" onClick={() => setDraft(new Set(shown.map(([v]) => v)))} className="text-[#1f6fe0] hover:underline">
            Only these
          </button>
        )}
      </div>
      <ul className="mt-2 max-h-64 overflow-y-auto">
        {shown.map(([v, n]) => (
          <li key={v}>
            <label className="group/opt flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-ink-04">
              <input type="checkbox" checked={isOn(v)} onChange={() => toggle(v)} />
              <span className="min-w-0 flex-1 truncate" title={v}>
                {v}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setDraft(new Set([v]));
                }}
                className="hidden text-[0.7rem] text-[#1f6fe0] hover:underline group-hover/opt:inline"
              >
                only
              </button>
              <span className="text-[0.72rem] text-ink-30 tabular-nums">{n}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="py-2 text-ink-30">No matches</li>}
      </ul>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-ink-15 py-1.5 text-ink-70 hover:border-ink-30">
          Cancel
        </button>
        <button type="button" onClick={apply} className="flex-1 rounded-lg bg-ink py-1.5 text-paper">
          Apply
        </button>
      </div>
    </div>
  );
}
