/**
 * Where the pages break.
 *
 * The canvas never answered this question: every element had a position, so
 * a paragraph that grew just ran off the bottom of the sheet and the page
 * clipped it. A flow document has to decide, and the only thing that knows
 * how tall a line of text really is — at that size, in that font, at that
 * width, with that hyphenation — is the browser. So nothing is estimated.
 * The blocks are rendered once, off-screen, at the exact width they will
 * occupy, measured, and only then dealt into pages.
 *
 * Blocks are atomic. A résumé splits naturally into pieces that should never
 * be cut in half — a section heading, one bullet, one education line — so the
 * engine never has to break inside anything. What it does have to respect is
 * that some pieces belong with the next one: a heading alone at the foot of a
 * page, or a job title separated from its first bullet, is the thing that
 * makes a résumé look broken even when nothing overflowed.
 */

export type Measured = {
  id: string;
  /** Rendered height in millimetres. */
  h: number;
  /** Space above this block when it is not first on a page. */
  gapBefore: number;
  /** This block must not be the last on a page. */
  keepWithNext: boolean;
};

export type Page = { ids: string[] };

/**
 * Greedy, top to bottom, with one look backwards.
 *
 * When a block does not fit, the break goes above it — and then walks back
 * over any run of `keepWithNext` blocks immediately before it, so a heading
 * and the first line under it travel together. The walk is bounded: if
 * everything above is glued, the page takes it anyway rather than looping,
 * because a block that cannot fit on any page still has to go somewhere.
 */
export function paginate(blocks: Measured[], pageHeight: number): Page[] {
  if (blocks.length === 0) return [{ ids: [] }];

  const pages: Page[] = [];
  let current: Measured[] = [];
  let used = 0;

  const flush = () => {
    if (current.length) pages.push({ ids: current.map((b) => b.id) });
    current = [];
    used = 0;
  };

  for (const b of blocks) {
    const gap = current.length ? b.gapBefore : 0;
    const needs = gap + b.h;

    if (used + needs <= pageHeight || current.length === 0) {
      current.push(b);
      used += needs;
      continue;
    }

    // It does not fit. Pull back any glued run that would otherwise be
    // stranded at the bottom of the page we are about to close.
    const carried: Measured[] = [];
    while (current.length > 1 && current[current.length - 1].keepWithNext) {
      carried.unshift(current.pop() as Measured);
    }
    for (const c of carried) used -= c.gapBefore + c.h;

    flush();

    for (const c of carried) {
      current.push(c);
      used += (current.length > 1 ? c.gapBefore : 0) + c.h;
    }
    current.push(b);
    used += (current.length > 1 ? b.gapBefore : 0) + b.h;
  }

  flush();
  return pages.length ? pages : [{ ids: [] }];
}

/**
 * Two columns, paginated together.
 *
 * The narrow column is usually the shorter one, so it is filled first and the
 * main column is given whatever height is left on that sheet. They share page
 * boundaries — a sidebar that ran onto its own second page while the main
 * column was still on the first would be two documents, not one.
 */
export function paginatePair(
  aside: Measured[],
  main: Measured[],
  pageHeight: number,
): { aside: Page[]; main: Page[] } {
  const a = paginate(aside, pageHeight);
  const m = paginate(main, pageHeight);
  const n = Math.max(a.length, m.length);
  while (a.length < n) a.push({ ids: [] });
  while (m.length < n) m.push({ ids: [] });
  return { aside: a, main: m };
}
