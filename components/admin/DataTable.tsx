"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FilterMenu } from "@/components/admin/JourneyTable";

/**
 * The admin panel's one table.
 *
 * Every list screen hands it plain rows and a column list — no functions, so
 * a server page can pass them straight through — and gets the same things
 * everywhere: a search box, sorting by any header, a spreadsheet-style
 * filter on any text column (the Journeys picker: tick several, Apply),
 * pages of 25 / 50 / 100, a sticky header, and CSV of exactly what is
 * filtered.
 *
 * Column kinds decide how a value is shown, sorted and filtered:
 *   text    as is; filter by value
 *   number  right-aligned; sorted as a number
 *   money   ₹, right-aligned
 *   date    ISO in, "4 Nov, 3:05 pm" (India time) out; filter by day
 *   badge   a pill; filter by value
 */

export type Cell = string | number | boolean | null;
export type Row = { id: string } & Record<string, Cell>;

export type Column = {
  key: string;
  label: string;
  kind?: "text" | "number" | "money" | "date" | "badge";
  /** A second, quieter line under the value: another key of the row. */
  sub?: string;
  /** Makes the value a link: the key of the row holding the URL. */
  href?: string;
  /** Opens the link in a new tab (wa.me, mailto…). */
  external?: boolean;
  /** Off by default for numbers, money and dates-as-time; on for the rest. */
  filter?: boolean;
  /** Keeps a long value on one line, cut with an ellipsis, at this width. */
  max?: string;
  /** Badge colours by value; anything else gets the neutral pill. */
  tones?: Record<string, "green" | "amber" | "blue" | "red" | "grey">;
};

const TONE = {
  green: "bg-[#e7f6ec] text-[#14532d]",
  amber: "bg-[#fff4e0] text-[#7a4b00]",
  blue: "bg-[#eef2ff] text-[#3730a3]",
  red: "bg-[#fdecec] text-[#9b1c1c]",
  grey: "bg-ink-04 text-ink-50",
};

const WHEN = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function shown(c: Column, v: Cell): string {
  if (v === null || v === undefined || v === "") return "—";
  if (c.kind === "date" && typeof v === "string") return WHEN.format(new Date(v));
  if (c.kind === "money" && typeof v === "number") return `₹${Math.round(v).toLocaleString("en-IN")}`;
  if (c.kind === "number" && typeof v === "number") return v.toLocaleString("en-IN");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** What a column's filter groups by. */
function facet(c: Column, v: Cell): string {
  if (v === null || v === undefined || v === "") return "—";
  if (c.kind === "date" && typeof v === "string") return DAY.format(new Date(v));
  return shown(c, v);
}

const filterable = (c: Column) => c.filter ?? (c.kind !== "number" && c.kind !== "money");

function csvCell(v: Cell): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function DataTable({
  rows,
  columns,
  name = "export",
  empty = "Nothing here yet.",
  initialSort,
}: {
  rows: Row[];
  columns: Column[];
  /** The CSV file's name. */
  name?: string;
  empty?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
}) {
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const [size, setSize] = useState(25);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter(
      (r) =>
        columns.every((c) => !filters[c.key] || filters[c.key].has(facet(c, r[c.key]))) &&
        (!needle ||
          columns.some((c) => {
            const v = r[c.key];
            const s = c.sub ? r[c.sub] : null;
            return (v !== null && String(v).toLowerCase().includes(needle)) || (s !== null && s !== undefined && String(s).toLowerCase().includes(needle));
          })),
    );
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      const k = sort.key;
      out = [...out].sort((a, b) => {
        const av = a[k];
        const bv = b[k];
        if (av === bv) return 0;
        if (av === null || av === undefined || av === "") return 1;
        if (bv === null || bv === undefined || bv === "") return -1;
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "en", { numeric: true });
        return (sort.dir === "asc" ? 1 : -1) * (c?.kind === "date" ? String(av).localeCompare(String(bv)) : cmp);
      });
    }
    return out;
  }, [rows, columns, filters, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const at = Math.min(page, pages - 1);
  const visible = filtered.slice(at * size, at * size + size);
  const active = Object.keys(filters).length;

  function toggleSort(key: string) {
    setPage(0);
    setSort((s) => (s?.key !== key ? { key, dir: "desc" } : s.dir === "desc" ? { key, dir: "asc" } : null));
  }

  function download() {
    const head = columns.flatMap((c) => (c.sub ? [c.label, `${c.label} (detail)`] : [c.label]));
    const lines = filtered.map((r) => columns.flatMap((c) => (c.sub ? [r[c.key], r[c.sub]] : [r[c.key]])).map(csvCell).join(","));
    const blob = new Blob([[head.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div>
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <svg viewBox="0 0 16 16" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-30" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search"
            aria-label="Search the table"
            className="w-full rounded-full border border-ink-08 bg-paper py-2 pl-8 pr-3 text-[0.82rem] outline-none transition-colors focus:border-ink-30"
          />
        </label>
        <span className="text-[0.78rem] tabular-nums text-ink-50">
          {filtered.length === rows.length ? `${rows.length.toLocaleString("en-IN")} rows` : `${filtered.length.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")}`}
        </span>
        {active > 0 &&
          Object.entries(filters).map(([k, set]) => (
            <span key={k} className="rounded-full bg-ink-04 px-2.5 py-1 text-[0.74rem]">
              {columns.find((c) => c.key === k)?.label}: {set.size === 1 ? [...set][0] : `${set.size} picked`}
            </span>
          ))}
        {(active > 0 || q) && (
          <button
            type="button"
            onClick={() => {
              setFilters({});
              setQ("");
              setPage(0);
            }}
            className="text-[0.76rem] text-ink-50 underline underline-offset-4 hover:text-ink"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={download}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-ink-08 bg-paper px-3 py-1.5 text-[0.76rem] text-ink-70 transition-colors hover:border-ink-30 hover:text-ink"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 13h10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          CSV
        </button>
      </div>

      {/* table */}
      <div className="max-h-[75vh] overflow-auto rounded-xl border border-ink-08 bg-paper">
        <table className="w-full min-w-[44rem] text-left text-[0.83rem]">
          <thead className="sticky top-0 z-10 bg-[#f7f7f5]">
            <tr>
              {columns.map((c) => {
                const right = c.kind === "number" || c.kind === "money";
                const sorted = sort?.key === c.key ? sort.dir : null;
                return (
                  <th key={c.key} className={`whitespace-nowrap px-3 py-2.5 font-medium ${right ? "text-right" : ""}`}>
                    <span className={`inline-flex items-center gap-1 ${right ? "flex-row-reverse" : ""}`}>
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={`text-[0.7rem] uppercase tracking-[0.08em] transition-colors ${sorted ? "text-ink" : "text-ink-50 hover:text-ink"}`}
                        title="Sort"
                      >
                        {c.label}
                        <span aria-hidden="true" className="ml-1 inline-block w-2 text-ink-30">
                          {sorted === "desc" ? "↓" : sorted === "asc" ? "↑" : ""}
                        </span>
                      </button>
                      {filterable(c) && (
                        <button
                          type="button"
                          aria-label={`Filter ${c.label}`}
                          onClick={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setMenu(menu?.id === c.key ? null : { id: c.key, x: r.left, y: r.bottom + 4 });
                          }}
                          className={`rounded px-0.5 text-[0.7rem] transition-colors ${filters[c.key] ? "text-[#1f6fe0]" : "text-ink-30 hover:text-ink"}`}
                        >
                          {filters[c.key] ? "●" : "▾"}
                        </button>
                      )}
                    </span>
                    {menu?.id === c.key && (
                      <FilterMenu
                        at={menu}
                        values={rows.map((r) => facet(c, r[c.key]))}
                        picked={filters[c.key] ?? null}
                        onClose={() => setMenu(null)}
                        onChange={(set) => {
                          setPage(0);
                          setFilters((f) => {
                            const next = { ...f };
                            if (set) next[c.key] = set;
                            else delete next[c.key];
                            return next;
                          });
                        }}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-ink-50">
                  {rows.length === 0 ? empty : "Nothing matches. Clear the search or filters."}
                </td>
              </tr>
            )}
            {visible.map((r) => (
              <tr key={r.id} className="border-t border-ink-08 transition-colors hover:bg-[#fafaf8]">
                {columns.map((c) => {
                  const v = r[c.key];
                  const right = c.kind === "number" || c.kind === "money";
                  const href = c.href ? (r[c.href] as string | null) : null;
                  const text = shown(c, v);
                  const body =
                    c.kind === "badge" && v !== null && v !== "" ? (
                      <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[0.72rem] font-medium ${TONE[c.tones?.[String(v)] ?? "grey"]}`}>
                        {text}
                      </span>
                    ) : (
                      text
                    );
                  return (
                    <td
                      key={c.key}
                      className={`px-3 py-2.5 align-top ${right ? "text-right tabular-nums" : ""} ${c.kind === "date" ? "whitespace-nowrap tabular-nums text-ink-50" : ""}`}
                    >
                      <span className={`block ${c.max ? `${c.max} truncate` : ""}`} title={c.max ? text : undefined}>
                        {href ? (
                          c.external ? (
                            <a href={href} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                              {body}
                            </a>
                          ) : (
                            <Link href={href} className="font-medium underline-offset-4 hover:underline">
                              {body}
                            </Link>
                          )
                        ) : (
                          body
                        )}
                      </span>
                      {c.sub && r[c.sub] !== null && r[c.sub] !== undefined && r[c.sub] !== "" && (
                        <span className={`block text-[0.74rem] text-ink-30 ${c.max ? `${c.max} truncate` : ""}`}>{String(r[c.sub])}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* pages */}
      {filtered.length > 25 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.78rem] text-ink-50">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(0);
              }}
              className="rounded-lg border border-ink-08 bg-paper px-2 py-1"
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <span className="mr-2 tabular-nums">
              {at * size + 1}–{Math.min(filtered.length, at * size + size)} of {filtered.length}
            </span>
            <button
              type="button"
              disabled={at === 0}
              onClick={() => setPage(at - 1)}
              className="rounded-full border border-ink-08 px-3 py-1 transition-colors hover:border-ink-30 disabled:opacity-30"
            >
              ‹ Prev
            </button>
            <button
              type="button"
              disabled={at >= pages - 1}
              onClick={() => setPage(at + 1)}
              className="rounded-full border border-ink-08 px-3 py-1 transition-colors hover:border-ink-30 disabled:opacity-30"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
