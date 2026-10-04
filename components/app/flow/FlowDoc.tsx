"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Resume } from "@/lib/app/resume-schema";
import { buildBlocks, type Block, type SectionId } from "@/lib/app/flow/blocks";
import { flowTheme, themeStyle, type Overrides } from "@/lib/app/flow/theme";
import { paginate, type Measured } from "@/lib/app/flow/paginate";

/**
 * The résumé, flowed onto sheets of paper.
 *
 * Two passes. The first renders every block once into a hidden layer that is
 * exactly as wide as the page's text column, and reads back how tall each one
 * came out; the second deals them into pages and renders those for real. The
 * measuring layer is not a trick — it is the only honest way to know the
 * height of a paragraph, because that depends on the font, the size, the
 * width and the browser's own line breaking, and every estimate of it is
 * wrong by the time somebody types a long word.
 *
 * It re-runs whenever the words or the design change, so a sentence that
 * pushes the last line past the bottom moves to the next sheet while the
 * person is still typing it, instead of disappearing off the edge.
 */
const A4_W = 210;
const A4_H = 297;
const MARGIN = 14;
const MM = 96 / 25.4;

export function FlowDoc({
  resume,
  templateId,
  order,
  overrides,
  zoom = 1,
  onPages,
}: {
  resume: Resume;
  templateId: string | null;
  order?: readonly SectionId[];
  overrides?: Overrides;
  zoom?: number;
  onPages?: (n: number) => void;
}) {
  const theme = useMemo(() => flowTheme(templateId, overrides), [templateId, overrides]);
  const blocks = useMemo(() => buildBlocks(resume, order), [resume, order]);

  const probe = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});

  // Measured after every paint that could have changed a height. Reading
  // layout here rather than in an effect keeps the two passes inside one
  // frame, so no half-laid-out document is ever shown.
  useLayoutEffect(() => {
    const el = probe.current;
    if (!el) return;
    const next: Record<string, number> = {};
    for (const child of Array.from(el.children)) {
      const id = (child as HTMLElement).dataset.block;
      if (id) next[id] = (child as HTMLElement).getBoundingClientRect().height / MM;
    }
    setHeights((prev) => {
      const same =
        Object.keys(next).length === Object.keys(prev).length &&
        Object.entries(next).every(([k, v]) => Math.abs((prev[k] ?? -1) - v) < 0.05);
      return same ? prev : next;
    });
  });

  const contentW = A4_W - MARGIN * 2;
  const contentH = A4_H - MARGIN * 2;

  const pages = useMemo(() => {
    if (Object.keys(heights).length === 0) return null;
    const measured: Measured[] = blocks.map((b) => ({
      id: b.id,
      h: heights[b.id] ?? 0,
      gapBefore: b.gapBefore,
      keepWithNext: b.keepWithNext,
    }));
    return paginate(measured, contentH);
  }, [blocks, heights, contentH]);

  useLayoutEffect(() => {
    if (pages) onPages?.(pages.length);
  }, [pages, onPages]);

  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const style = themeStyle(theme);

  return (
    <>
      {/* The measuring layer. Same width, same type, no paint. */}
      <div
        ref={probe}
        aria-hidden="true"
        style={{
          ...style,
          position: "fixed",
          top: 0,
          left: 0,
          width: `${contentW}mm`,
          visibility: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        {blocks.map((b) => (
          <div key={b.id} data-block={b.id}>
            {b.node}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6mm", alignItems: "center" }}>
        {(pages ?? [{ ids: [] }]).map((page, i) => (
          <div
            key={i}
            className="shadow-[0_2px_18px_rgba(0,0,0,0.10)]"
            style={{
              ...style,
              width: `${A4_W}mm`,
              height: `${A4_H}mm`,
              padding: `${MARGIN}mm`,
              background: "#fff",
              boxSizing: "border-box",
              overflow: "hidden",
              transform: zoom === 1 ? undefined : `scale(${zoom})`,
              transformOrigin: "top center",
              marginBottom: zoom === 1 ? undefined : `${A4_H * (zoom - 1)}mm`,
            }}
          >
            {page.ids.map((id, n) => {
              const b = byId.get(id);
              if (!b) return null;
              return (
                <div
                  key={id}
                  data-path={b.path ?? undefined}
                  style={{ marginTop: n === 0 ? 0 : `${b.gapBefore}mm` }}
                >
                  {b.node}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
