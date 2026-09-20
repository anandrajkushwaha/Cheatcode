"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CANONICAL_CITIES } from "@/lib/geo/cities";

/**
 * The filter rail.
 *
 * Every control writes to the URL rather than to local state. That costs a
 * navigation per change and buys three things worth more: a filtered list you
 * can send somebody, a back button that undoes one filter, and a page that
 * renders identically on reload.
 *
 * On a phone the same rail is a sheet. Not a second set of controls — the
 * same component, moved: two implementations of "filter by city" is how one
 * of them ends up missing the remote checkbox.
 *
 * One thing this rail does NOT do is show counts next to each option. Naukri
 * does, and it is genuinely useful, but it needs a faceted count query per
 * filter value; guessing them, or showing the unfiltered totals, would be
 * worse than showing none.
 */

export const EXPERIENCE = [
  { value: 0, label: "Fresher" },
  { value: 1, label: "1 yr" },
  { value: 2, label: "2 yrs" },
  { value: 3, label: "3 yrs" },
  { value: 5, label: "5 yrs" },
  { value: 7, label: "7 yrs" },
  { value: 10, label: "10+ yrs" },
];

export const FRESHNESS = [
  { value: 1, label: "Last 24 hours" },
  { value: 3, label: "Last 3 days" },
  { value: 7, label: "Last week" },
  { value: 15, label: "Last 15 days" },
  { value: 30, label: "Last month" },
];

export type Filters = {
  q: string;
  cities: string[];
  remote: boolean;
  maxYears: number | null;
  maxAgeDays: number | null;
};

export function JobFilterRail({ filters }: { filters: Filters }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any change to a filter invalidates the page you were on.
    next.delete("page");
    // "touched" is how the page knows not to re-apply the profile's defaults
    // over a filter somebody has just cleared on purpose.
    next.set("t", "1");
    router.push(`/app/jobs?${next.toString()}`, { scroll: false });
  }

  const toggleCity = (city: string) => {
    const next = filters.cities.includes(city)
      ? filters.cities.filter((c) => c !== city)
      : [...filters.cities, city];
    apply({ cities: next.join(",") || null });
  };

  const active =
    filters.cities.length > 0 ||
    filters.remote ||
    filters.maxYears !== null ||
    filters.maxAgeDays !== null;

  const body = (
    <div className="space-y-7">
      <Group title="Work mode">
        <div className="flex flex-wrap gap-2">
          <Chip on={!filters.remote} onClick={() => apply({ remote: null })}>
            Any
          </Chip>
          <Chip on={filters.remote} onClick={() => apply({ remote: filters.remote ? null : "1" })}>
            Remote only
          </Chip>
        </div>
      </Group>

      <Group
        title="Location"
        note={filters.remote ? "Remote roles show wherever you are." : undefined}
      >
        <div className="flex flex-wrap gap-2">
          {CANONICAL_CITIES.map((city) => (
            <Chip key={city} on={filters.cities.includes(city)} onClick={() => toggleCity(city)}>
              {city}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Experience" note="Shows roles asking for this much or less.">
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE.map((e) => (
            <Chip
              key={e.value}
              on={filters.maxYears === e.value}
              onClick={() =>
                apply({ exp: filters.maxYears === e.value ? null : String(e.value) })
              }
            >
              {e.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Posted">
        <div className="flex flex-wrap gap-2">
          <Chip on={filters.maxAgeDays === null} onClick={() => apply({ age: null })}>
            Any time
          </Chip>
          {FRESHNESS.map((f) => (
            <Chip
              key={f.value}
              on={filters.maxAgeDays === f.value}
              onClick={() =>
                apply({ age: filters.maxAgeDays === f.value ? null : String(f.value) })
              }
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </Group>

      {active && (
        <button
          type="button"
          onClick={() => apply({ cities: null, remote: null, exp: null, age: null })}
          className="text-[0.82rem] text-ink-50 underline underline-offset-4 hover:text-ink"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: a sticky column beside the list. */}
      <aside className="hidden lg:block">
        <div className="sticky top-[84px] max-h-[calc(100dvh-104px)] overflow-y-auto rounded-2xl border border-ink-08 bg-paper p-5 [scrollbar-width:thin]">
          <p className="mb-5 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Filters
          </p>
          {body}
        </div>
      </aside>

      {/* Phone: one button, and the same controls in a sheet. */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-ink-15 bg-paper px-5 py-2.5 text-[0.85rem] font-medium transition-colors hover:border-ink-30"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-[15px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filters
          {active && <span className="size-1.5 rounded-full bg-sky-1" />}
        </button>

        {open && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/30" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82dvh] overflow-y-auto rounded-t-3xl bg-paper p-5 pb-8"
            >
              <div className="mb-5 flex items-center justify-between">
                <p className="text-[0.95rem] font-semibold">Filters</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full px-3 py-1.5 text-[0.82rem] text-ink-50 hover:bg-ink-04 hover:text-ink"
                >
                  Done
                </button>
              </div>
              {body}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- pieces */

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[0.85rem] font-medium">{title}</p>
      {note && <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-30">{note}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-[0.79rem] transition-colors ${
        on
          ? "border-ink bg-ink text-paper"
          : "border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------- search and sort */

export function JobSearchBar({ q, sort }: { q: string; sort: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState(q);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in step when the URL changes underneath it — a back button,
  // or "clear all" in the rail.
  useEffect(() => {
    setText(params.get("q") ?? "");
  }, [params]);

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    next.set("t", "1");
    router.push(`/app/jobs?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-full border border-ink-15 bg-paper py-2 pl-4 pr-2 transition-colors focus-within:border-ink-30">
        <svg viewBox="0 0 24 24" aria-hidden className="size-[16px] shrink-0 text-ink-30" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (typing.current) clearTimeout(typing.current);
            // Long enough that ordinary typing produces one navigation, not ten.
            typing.current = setTimeout(() => apply({ q: e.target.value.trim() || null }), 450);
          }}
          placeholder="Search by role or company"
          aria-label="Search jobs"
          className="min-w-0 flex-1 bg-transparent py-1 text-[0.88rem] outline-none placeholder:text-ink-30"
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("");
              apply({ q: null });
            }}
            aria-label="Clear search"
            className="shrink-0 rounded-full px-2 py-1 text-[0.78rem] text-ink-30 hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      <label className="flex shrink-0 items-center gap-2 text-[0.8rem] text-ink-50">
        Sort
        <select
          value={sort}
          onChange={(e) => apply({ sort: e.target.value === "recent" ? null : e.target.value })}
          className="rounded-full border border-ink-15 bg-paper px-3 py-2 text-[0.82rem] text-ink outline-none transition-colors hover:border-ink-30"
        >
          <option value="recent">Newest first</option>
          <option value="relevance">Best match</option>
          <option value="salary">Highest paying</option>
        </select>
      </label>
    </div>
  );
}
