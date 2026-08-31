"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CANONICAL_CITIES } from "@/lib/geo/cities";

/**
 * Search and filters, Naukri's shape: one query box, then chips.
 *
 * Every control writes to the URL rather than to local state. That costs a
 * navigation per change and buys three things worth more than the navigation:
 * a filtered list you can send someone, a back button that goes back one
 * filter, and a page that renders the same on a reload.
 */
export function JobFilters({
  defaults,
}: {
  defaults: { q: string; cities: string[]; remote: boolean; maxYears: number | null };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(defaults.q);
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in step when the URL changes underneath it — a back button,
  // or the "clear all" link below.
  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  function apply(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any change to a filter invalidates the page you were on.
    next.delete("page");
    router.push(`/app/jobs?${next.toString()}`);
  }

  function onType(value: string) {
    setQ(value);
    if (typing.current) clearTimeout(typing.current);
    // Long enough that a normal typing speed produces one navigation, not ten.
    typing.current = setTimeout(() => apply({ q: value.trim() || null }), 450);
  }

  const cities = defaults.cities;
  const toggleCity = (city: string) => {
    const next = cities.includes(city) ? cities.filter((c) => c !== city) : [...cities, city];
    apply({ cities: next.join(",") || null });
  };

  const active =
    defaults.q || cities.length > 0 || defaults.remote || defaults.maxYears !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-ink-15 bg-paper p-1.5 pl-4 transition-colors focus-within:border-sky-1">
        <SearchMark />
        <input
          value={q}
          onChange={(e) => onType(e.target.value)}
          placeholder="Job title, skill or company"
          aria-label="Search jobs"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[0.95rem] outline-none placeholder:text-ink-30"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CANONICAL_CITIES.map((city) => {
          const on = cities.includes(city);
          return (
            <button
              key={city}
              type="button"
              onClick={() => toggleCity(city)}
              aria-pressed={on}
              className={`rounded-full px-3.5 py-1.5 text-[0.8rem] transition-colors ${
                on
                  ? "bg-ink text-paper"
                  : "border border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
              }`}
            >
              {city}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => apply({ remote: defaults.remote ? null : "1" })}
          aria-pressed={defaults.remote}
          className={`rounded-full px-3.5 py-1.5 text-[0.8rem] transition-colors ${
            defaults.remote
              ? "bg-ink text-paper"
              : "border border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
          }`}
        >
          Remote only
        </button>

        <label className="flex items-center gap-2 text-[0.8rem] text-ink-50">
          My experience
          <select
            value={defaults.maxYears ?? ""}
            onChange={(e) => apply({ exp: e.target.value || null })}
            className="rounded-full border border-ink-15 bg-paper px-3 py-1.5 text-[0.8rem] text-ink outline-none"
          >
            <option value="">Any</option>
            <option value="0">Fresher</option>
            <option value="1">1 year</option>
            <option value="2">2 years</option>
            <option value="3">3 years</option>
            <option value="5">5 years</option>
            <option value="8">8 years</option>
            <option value="12">12+ years</option>
          </select>
        </label>

        {active && (
          <button
            type="button"
            onClick={() => router.push("/app/jobs")}
            className="text-[0.8rem] text-ink-30 underline underline-offset-4 hover:text-ink"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function SearchMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0 text-ink-30">
      <circle cx="9" cy="9" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.2 13.2 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
