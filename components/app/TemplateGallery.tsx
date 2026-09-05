"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ResumeDocument } from "@/components/app/ResumeDocument";
import {
  FACETS,
  filterTemplates,
  TEMPLATES,
  type Filters,
} from "@/lib/app/resume-templates";
import type { Resume } from "@/lib/app/resume-schema";

/**
 * The wall of templates, with the person's own resume inside every one.
 *
 * Canva shows you a stranger's CV, because Canva has never seen yours. By the
 * time anybody reaches this screen there is a draft seeded from their upload,
 * so each card can render the real document with their name and their jobs in
 * it. That removes the "will it look like that with my content in it" step,
 * which is the step where template galleries usually lose people.
 *
 * The previews are the component, not pictures of it. Ten live documents on a
 * page is cheap because they are text, and it means a template can never look
 * one way on the card and another way in the editor.
 *
 * Choosing one creates a **new** resume in that template rather than re-
 * painting the current one, so trying a second template does not destroy the
 * first. The reasoning is in `createFromTemplate`.
 */

/**
 * 210mm at 96dpi, and the width a card is drawn at.
 *
 * These two numbers have to agree, which is why the grid below uses a fixed
 * column width rather than `1fr`. With flexible columns the page was scaled to
 * 260px inside a card that had stretched to 320, so every preview sat in the
 * top-left corner of its own frame with a band of empty white beside it — the
 * documents looked broken when the only broken thing was the arithmetic.
 */
const PAGE_PX = 794;
const CARD_PX = 240;

export function TemplateGallery({
  content,
  current,
}: {
  content: Resume;
  current: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({});
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => filterTemplates(TEMPLATES, filters), [filters]);

  const chosen = (facet: keyof Omit<Filters, "search">, value: string) =>
    (filters[facet] ?? []).includes(value);

  function toggle(facet: keyof Omit<Filters, "search">, value: string) {
    setFilters((f) => {
      const list = f[facet] ?? [];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...f, [facet]: next.length ? next : undefined };
    });
  }

  const activeCount =
    (filters.style?.length ?? 0) +
    (filters.colour?.length ?? 0) +
    (filters.layout?.length ?? 0) +
    (filters.role?.length ?? 0);

  async function use(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/app/resume/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: id }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "That didn't open.");
      router.push("/app/resume/builder");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't open.");
      setBusy(null);
    }
  }

  return (
    <>
      {/* ----------------------------------------------------- search row */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Search templates</span>
          <SearchIcon />
          <input
            type="search"
            value={filters.search ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Search templates"
            className="w-full rounded-full border border-ink-15 bg-transparent py-2.5 pl-10 pr-4 text-[0.88rem] outline-none transition-colors placeholder:text-ink-30 focus:border-ink"
          />
        </label>

        <button
          type="button"
          onClick={() => setPanel((p) => !p)}
          aria-expanded={panel}
          className={[
            "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[0.85rem] font-medium transition-colors",
            panel || activeCount ? "border-ink" : "border-ink-15 hover:border-ink-30",
          ].join(" ")}
        >
          <FilterIcon />
          All filters
          {activeCount > 0 && (
            <span className="rounded-full bg-ink px-1.5 text-[0.7rem] font-semibold text-paper tabular-nums">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* --------------------------------------------------- filter panel */}
      {panel && (
        <div className="mt-4 rounded-2xl border border-ink-08 p-5">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            <Group title="Style" facet="style" facets={FACETS.style} chosen={chosen} toggle={toggle} />
            <Group title="Layout" facet="layout" facets={FACETS.layout} chosen={chosen} toggle={toggle} />
            <Group title="Colour" facet="colour" facets={FACETS.colour} chosen={chosen} toggle={toggle} />
            <Group title="Role" facet="role" facets={FACETS.role} chosen={chosen} toggle={toggle} />
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-ink-08 pt-4">
            <button
              type="button"
              onClick={() => setFilters((f) => ({ search: f.search }))}
              disabled={!activeCount}
              className="text-[0.82rem] text-ink-50 underline-offset-4 hover:text-ink hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              Clear all
            </button>
            <span className="text-[0.8rem] text-ink-50 tabular-nums">
              {shown.length} of {TEMPLATES.length}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-5 rounded-xl border border-ink-15 bg-ink-04 px-4 py-3 text-[0.85rem]">
          {error}
        </p>
      )}

      {/* ----------------------------------------------------------- grid */}
      {shown.length === 0 ? (
        <p className="mt-10 text-[0.9rem] text-ink-50">
          Nothing matches that. Try clearing a filter.
        </p>
      ) : (
        <div className="mt-7 grid grid-cols-[repeat(auto-fill,240px)] justify-between gap-x-6 gap-y-8">
          {shown.map((t) => {
            const isCurrent = t.id === current;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => use(t.id)}
                disabled={busy !== null}
                className="group block w-full text-left disabled:cursor-wait"
              >
                <div
                  className={[
                    "relative overflow-hidden rounded-xl border bg-white transition-all",
                    isCurrent
                      ? "border-ink ring-2 ring-ink ring-offset-2 ring-offset-paper"
                      : "border-ink-15 group-hover:-translate-y-0.5 group-hover:border-ink-30 group-hover:shadow-lg",
                  ].join(" ")}
                  style={{ width: CARD_PX, aspectRatio: "210 / 297" }}
                >
                  {/* The real document at full page width, scaled to fit.
                      Transform rather than a smaller font size, so what is on
                      the card is exactly what prints. */}
                  <div
                    aria-hidden
                    className="pointer-events-none origin-top-left"
                    style={{ width: PAGE_PX, transform: `scale(${CARD_PX / PAGE_PX})` }}
                  >
                    <ResumeDocument content={content} template={t.id} />
                  </div>

                  {busy === t.id && (
                    <div className="absolute inset-0 grid place-items-center bg-white/75 text-[0.8rem] font-medium">
                      Opening…
                    </div>
                  )}
                </div>

                <p className="mt-3 text-[0.88rem] leading-snug">{t.name}</p>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function Group({
  title,
  facet,
  facets,
  chosen,
  toggle,
}: {
  title: string;
  facet: keyof Omit<Filters, "search">;
  facets: { value: string; count: number }[];
  chosen: (facet: keyof Omit<Filters, "search">, value: string) => boolean;
  toggle: (facet: keyof Omit<Filters, "search">, value: string) => void;
}) {
  // Long facet lists collapse. The role list is the one that grows without
  // limit, and a filter panel taller than the grid it filters is not a filter.
  const [all, setAll] = useState(false);
  const visible = all ? facets : facets.slice(0, 6);

  return (
    <div>
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-ink-50">{title}</p>
      <div className="mt-3 space-y-2">
        {visible.map((f) => (
          <label key={f.value} className="flex cursor-pointer items-center gap-2.5 text-[0.85rem]">
            <input
              type="checkbox"
              checked={chosen(facet, f.value)}
              onChange={() => toggle(facet, f.value)}
              className="h-3.5 w-3.5 shrink-0 accent-black"
            />
            <span className="min-w-0 truncate">{f.value}</span>
            <span className="text-[0.78rem] text-ink-30 tabular-nums">({f.count})</span>
          </label>
        ))}
      </div>
      {facets.length > 6 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-2.5 text-[0.8rem] text-ink-50 underline-offset-4 hover:text-ink hover:underline"
        >
          {all ? "View less" : `View more (${facets.length - 6})`}
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L14 14" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 4h12M4 8h8M6.5 12h3" strokeLinecap="round" />
    </svg>
  );
}
