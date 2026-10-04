import type { Block } from "@/lib/app/flow/blocks";
import { paginate, paginatePair, type Measured, type Page } from "@/lib/app/flow/paginate";
import type { FlowTheme } from "@/lib/app/flow/theme";

/**
 * Where everything sits on the sheet, as arithmetic.
 *
 * Pulled out of the renderer on purpose. Measuring needs a browser, but
 * *deciding* — how wide each column is, how much room page three has left,
 * which block lands where — is pure, and keeping it pure is what lets the
 * same answer be computed on a server for the PDF as in the editor for the
 * preview. A PDF that paginates differently from the preview it was made
 * from is the oldest complaint about document software, and it comes from
 * having two of this function.
 */
export const A4_W = 210;
export const A4_H = 297;
export const MARGIN = 14;
/** The narrow column's own side padding. */
export const APAD = 9;
/** The wide column's padding on the side that faces the narrow one. */
export const GUT = 11;
/** How much a footer band takes off every page. */
export const FOOT = 26;
/** Air between a full-width header and the columns under it. */
export const HEAD_GAP = 7;
/** Millimetres per CSS pixel, at 96dpi. */
export const MM = 96 / 25.4;

export type Geometry = {
  hasAside: boolean;
  asideW: number;
  /** Text widths, in millimetres — what each column is measured at. */
  headW: number;
  asideInner: number;
  mainInner: number;
};

export function geometryOf(t: FlowTheme): Geometry {
  const hasAside = t.shape.aside !== "none";
  const asideW = hasAside ? t.shape.asideMm : 0;
  const headW = A4_W - MARGIN * 2;
  return {
    hasAside,
    asideW,
    headW,
    asideInner: Math.max(10, asideW - APAD * 2),
    mainInner: hasAside ? A4_W - asideW - GUT - MARGIN : headW,
  };
}

export type Columns = { head: Block[]; aside: Block[]; main: Block[] };

export function columnsOf(blocks: Block[]): Columns {
  return {
    head: blocks.filter((b) => b.column === "head"),
    aside: blocks.filter((b) => b.column === "aside"),
    main: blocks.filter((b) => b.column === "main"),
  };
}

export type Plan = {
  /** One entry per sheet. `aside` is null for the single-column layouts. */
  pages: { main: Page; aside: Page | null }[];
  /** Height of the full-width header strip, including the air under it. */
  headRoom: number;
};

/**
 * Deal the blocks onto sheets.
 *
 * `heights` is in millimetres and comes from the browser. With none of it —
 * the first render, or a server with no layout engine — this returns null
 * rather than guessing, and the caller shows one empty sheet. An estimated
 * page break is worse than a late one: it moves under somebody as the real
 * measurement arrives.
 */
export function planPages(
  blocks: Block[],
  heights: Record<string, number>,
  t: FlowTheme,
): Plan | null {
  if (Object.keys(heights).length === 0) return null;

  const cols = columnsOf(blocks);
  const measure = (list: Block[]): Measured[] =>
    list.map((b) => ({
      id: b.id,
      h: heights[b.id] ?? 0,
      gapBefore: b.gapBefore,
      keepWithNext: b.keepWithNext,
    }));

  const headRoom =
    cols.head.length === 0
      ? 0
      : cols.head.reduce((acc, b, i) => acc + (i === 0 ? 0 : b.gapBefore) + (heights[b.id] ?? 0), 0) +
        HEAD_GAP;

  const foot = t.shape.footerBand ? FOOT : 0;
  const room = (i: number) => A4_H - MARGIN * 2 - foot - (i === 0 ? headRoom : 0);

  if (t.shape.aside === "none") {
    return {
      headRoom,
      pages: paginate(measure(cols.main), room).map((main) => ({ main, aside: null })),
    };
  }

  const pair = paginatePair(measure(cols.aside), measure(cols.main), room);
  return {
    headRoom,
    pages: pair.main.map((main, i) => ({ main, aside: pair.aside[i] ?? { ids: [] } })),
  };
}
