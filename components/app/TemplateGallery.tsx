"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DesignPage, DesignStyles } from "@/components/app/DesignPage";
import { A4 } from "@/lib/app/design";
import { seedDesign } from "@/lib/app/design-seed";
import { previewDesign } from "@/lib/app/design-sample";
import {
  FACETS,
  filterTemplates,
  TEMPLATES,
  type Facet,
  type Filters,
} from "@/lib/app/resume-templates";
import type { Resume } from "@/lib/app/resume-schema";

/**
 * The wall of templates.
 *
 * Cards show a **sample** résumé, not the person's own — a reversal, and worth
 * saying why. The original rule was "we have their document, so show it", on
 * the reasoning that it removes the "will it look like that with my content"
 * step. In practice most people arrive with a thin résumé, and a thin résumé
 * renders into every template as the same short page with white space under
 * it. Ten cards, one apparent design, and the differences that make the choice
 * — the sidebar, the split, the timeline — invisible in all of them.
 *
 * So the sample is long enough to fill every section a template can lay out,
 * and the photo frames are filled so a frame reads as "your photo goes here"
 * rather than as a missing image. There is a switch below for anybody who
 * would rather see their own words; it is off by default because the job of
 * this screen is choosing a layout, not previewing content.
 *
 * The previews are the component, not pictures of it — the same `DesignPage`
 * the editor and the PDF use. A template cannot look one way on the card and
 * another way once it is open, because there is nothing else for it to be.
 */

/** 210mm at 96dpi. The page's true width in CSS pixels. */
const PAGE_PX = A4.w * (96 / 25.4);

export function TemplateGallery({ content, current }: { content: Resume; current: string }) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({});
  const [draft, setDraft] = useState<Filters>({});
  const [panel, setPanel] = useState(false);
  /**
   * Show my own résumé in the cards instead of the sample.
   *
   * Off by default. The switch exists because the reasoning behind the old
   * behaviour was not wrong — seeing your own words in a layout genuinely does
   * answer a question — it was just the wrong default for a screen whose job
   * is to make ten layouts distinguishable from each other.
   */
  const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => filterTemplates(TEMPLATES, filters), [filters]);
  const active = countChosen(filters);

  /**
   * How wide a card actually is, measured.
   *
   * The previews are real pages scaled down, and the scale has to match the
   * column width or every document sits in the corner of an oversized frame
   * with white beside it — which is exactly what the fixed-width version of
   * this file did, and it made ten fine templates look broken. CSS cannot
   * divide a length by a length, so the width is measured and the scale
   * follows it, and the grid gets to be properly responsive instead.
   */
  const grid = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState(240);

  useLayoutEffect(() => {
    const node = grid.current;
    if (!node) return;
    const measure = () => {
      const first = node.firstElementChild as HTMLElement | null;
      if (first?.offsetWidth) setCard(first.offsetWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [shown.length]);

  async function choose(template: string) {
    setBusy(template);
    setError(null);
    try {
      const res = await fetch("/api/app/resume/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "That didn't work.");
      router.push("/app/resume/builder");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
      setBusy(null);
    }
  }

  return (
    <>
      <DesignStyles />

      <div className="flex flex-wrap items-center gap-2.5">
        <input
          value={filters.search ?? ""}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Search templates"
          className="min-w-[200px] flex-1 rounded-full border border-ink-15 px-4 py-2.5 text-[0.86rem] outline-none transition-colors focus:border-ink-30"
        />
        <button
          type="button"
          onClick={() => {
            setDraft(filters);
            setPanel(true);
          }}
          className="flex items-center gap-2 rounded-full border border-ink-15 px-4 py-2.5 text-[0.84rem] font-medium transition-colors hover:border-ink"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 6h14M6 10h8M8.5 14h3" />
          </svg>
          All filters
          {active > 0 && (
            <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-ink px-1 text-[0.68rem] font-semibold text-paper">
              {active}
            </span>
          )}
        </button>
      </div>

      {error && <p className="mt-3 text-[0.84rem]">{error}</p>}

      <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-[0.78rem] text-ink-50">
        <input
          type="checkbox"
          checked={mine}
          onChange={(e) => setMine(e.target.checked)}
          className="h-3.5 w-3.5 accent-black"
        />
        Show my own details in the previews
      </label>

      <div
        ref={grid}
        className="mt-5 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4"
      >
        {shown.map((t) => {
          const design = mine ? seedDesign(content, t.id) : previewDesign(t.id);
          const scale = card / PAGE_PX;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => void choose(t.id)}
              disabled={Boolean(busy)}
              className="group text-left disabled:opacity-60"
            >
              <span
                className={`block overflow-hidden rounded-xl border bg-white transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg ${
                  t.id === current ? "border-ink ring-2 ring-ink/15" : "border-ink-08"
                }`}
                style={{ height: card * (A4.h / A4.w) }}
              >
                <span className="block origin-top-left" style={{ transform: `scale(${scale})` }}>
                  <DesignPage page={design.pages[0]} />
                </span>
              </span>

              {/* Tight to the card. The old version left a band of empty space
                  under every preview, which read as a gap in the grid. */}
              <span className="mt-1.5 block text-[0.8rem] font-medium leading-snug">
                {busy === t.id ? "Opening…" : t.name}
              </span>
              <span className="block text-[0.72rem] text-ink-30">
                {t.style} · {t.colour}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 && (
        <p className="mt-8 text-[0.88rem] text-ink-50">
          Nothing matches those filters.{" "}
          <button type="button" onClick={() => setFilters({})} className="underline underline-offset-2">
            Clear them
          </button>
          .
        </p>
      )}

      {panel && (
        <FilterDrawer
          draft={draft}
          setDraft={setDraft}
          onApply={() => {
            setFilters({ ...draft, search: filters.search });
            setPanel(false);
          }}
          onClear={() => setDraft({})}
          onClose={() => setPanel(false)}
        />
      )}
    </>
  );
}

function countChosen(f: Filters): number {
  return (f.style?.length ?? 0) + (f.colour?.length ?? 0) + (f.layout?.length ?? 0) + (f.role?.length ?? 0);
}

/**
 * Filters, in a drawer down the side.
 *
 * It used to drop down from the button, which meant the choices covered the
 * results they were about to change and ran off the bottom of the screen the
 * moment a facet had more than a handful of values. A side panel is what Canva
 * uses and it is the right shape: the list scrolls, and **Clear all** and
 * **Apply** stay pinned to the bottom where they can always be reached.
 *
 * Three ways out, because all three were asked for and each is somebody's
 * habit: the cross, a click on the page behind it, and Escape. Choices are
 * held in a draft until Apply, so ticking four boxes re-renders the grid once
 * rather than four times.
 */
function FilterDrawer({
  draft,
  setDraft,
  onApply,
  onClear,
  onClose,
}: {
  draft: Filters;
  setDraft: (f: Filters) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const toggle = (facet: keyof Omit<Filters, "search">, value: string) => {
    const list = draft[facet] ?? [];
    setDraft({
      ...draft,
      [facet]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    });
  };

  const facets: [keyof Omit<Filters, "search">, string, Facet[]][] = [
    ["style", "Style", FACETS.style],
    ["colour", "Colour", FACETS.colour],
    ["layout", "Layout", FACETS.layout],
    ["role", "Role", FACETS.role],
  ];

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Filters">
      {/* The scrim is the click-outside. One element, one handler, and no
          document-level listener that has to guess what counts as outside. */}
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/25"
      />

      <aside className="relative flex h-full w-[320px] max-w-[86vw] flex-col bg-paper shadow-2xl">
        <header className="flex items-center justify-between border-b border-ink-08 px-5 py-4">
          <h2 className="text-[0.95rem] font-semibold">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 rounded-lg p-1.5 text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {facets.map(([key, label, values]) => (
            <section key={key} className="mb-6 last:mb-0">
              <h3 className="mb-2 text-[0.86rem] font-semibold">{label}</h3>
              <div className="space-y-0.5">
                {values.map(({ value, count }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-ink-04"
                  >
                    <input
                      type="checkbox"
                      checked={(draft[key] ?? []).includes(value)}
                      onChange={() => toggle(key, value)}
                      className="h-4 w-4 accent-black"
                    />
                    <span className="flex-1 text-[0.86rem]">{value}</span>
                    <span className="text-[0.76rem] tabular-nums text-ink-30">({count})</span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-ink-08 px-5 py-3.5">
          <button
            type="button"
            onClick={onClear}
            className="flex-1 rounded-full border border-ink-15 py-2.5 text-[0.84rem] font-medium transition-colors hover:border-ink"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 rounded-full bg-ink py-2.5 text-[0.84rem] font-semibold text-paper transition-transform hover:scale-[1.02]"
          >
            Apply
          </button>
        </footer>
      </aside>
    </div>
  );
}
