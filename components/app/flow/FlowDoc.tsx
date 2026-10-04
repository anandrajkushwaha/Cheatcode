"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Resume } from "@/lib/app/resume-schema";
import { buildBlocks, type SectionId } from "@/lib/app/flow/blocks";
import { flowTheme, type Overrides } from "@/lib/app/flow/theme";
import { MM, planPages } from "@/lib/app/flow/layout";
import { FlowPages, FlowProbe } from "@/components/app/flow/FlowPages";

/**
 * The résumé, flowed onto sheets of paper.
 *
 * Two passes. The first renders every block once into a hidden layer that is
 * exactly as wide as the column it will end up in, and reads back how tall it
 * came out; the second deals them into pages and renders those for real. The
 * measuring layer is not a trick — it is the only honest way to know the
 * height of a paragraph, because that depends on the font, the size, the
 * width and the browser's own line breaking, and every estimate of it is
 * wrong by the time somebody types a long word.
 *
 * It re-runs whenever the words or the design change, so a sentence that
 * pushes the last line past the bottom moves to the next sheet while the
 * person is still typing it, instead of disappearing off the edge.
 *
 * The hidden layer is portalled to `document.body` rather than rendered in
 * place, and that is load-bearing: the preview is shown scaled down, and a
 * `zoom` or `transform` on an ancestor scales what `getBoundingClientRect`
 * reports. Measured inside the scaled subtree, a two-page résumé fits on one
 * page — the heights come back 38% short and nothing looks wrong until you
 * count the pages.
 */
export function FlowDoc({
  resume,
  templateId,
  photo,
  order,
  overrides,
  onPages,
}: {
  resume: Resume;
  templateId: string | null;
  /** A data URL, for the templates that reserve a frame. */
  photo?: string | null;
  order?: readonly SectionId[];
  overrides?: Overrides;
  onPages?: (n: number) => void;
}) {
  const theme = useMemo(() => flowTheme(templateId, overrides), [templateId, overrides]);
  const blocks = useMemo(
    () => buildBlocks(resume, theme, { order, photo }),
    [resume, theme, order, photo],
  );

  const probe = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // Measured after every paint that could have changed a height. Reading
  // layout here rather than in an effect keeps the two passes inside one
  // frame, so no half-laid-out document is ever shown.
  useLayoutEffect(() => {
    const el = probe.current;
    if (!el) return;
    const next: Record<string, number> = {};
    for (const child of Array.from(el.querySelectorAll<HTMLElement>("[data-block]"))) {
      const id = child.dataset.block;
      if (id) next[id] = child.getBoundingClientRect().height / MM;
    }
    setHeights((prev) => {
      const same =
        Object.keys(next).length === Object.keys(prev).length &&
        Object.entries(next).every(([k, v]) => Math.abs((prev[k] ?? -1) - v) < 0.05);
      return same ? prev : next;
    });
  });

  const plan = useMemo(() => planPages(blocks, heights, theme), [blocks, heights, theme]);

  useLayoutEffect(() => {
    if (plan) onPages?.(plan.pages.length);
  }, [plan, onPages]);

  return (
    <>
      {/* The measuring layer, outside every scaled ancestor. */}
      {ready &&
        createPortal(
          <div
            ref={probe}
            aria-hidden="true"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              visibility: "hidden",
              pointerEvents: "none",
              zIndex: -1,
            }}
          >
            <FlowProbe blocks={blocks} theme={theme} />
          </div>,
          document.body,
        )}

      <FlowPages
        blocks={blocks}
        plan={plan}
        theme={theme}
        className="shadow-[0_2px_18px_rgba(0,0,0,0.10)]"
      />
    </>
  );
}
