import {
  A4,
  blankPage,
  bounds,
  newId,
  reorder,
  unionBounds,
  type Design,
  type Element,
  type Page,
} from "@/lib/app/design";

/**
 * Everything the editor does to a design, as functions.
 *
 * No React, no DOM, no pointer events. Each of these takes a design and gives
 * back a new one, which buys three things that matter more than they look:
 * undo is a stack of these results rather than a log of intentions; the whole
 * feature set can be tested without a browser; and the canvas is left to do
 * only the thing that genuinely needs a browser, which is turning a pointer
 * into a millimetre.
 *
 * Immutability is real here, not decorative. Undo keeps references to previous
 * designs, so a single mutated element would silently rewrite history — you
 * would press Ctrl-Z and get back the state you were already in.
 */

/* -------------------------------------------------------------- one page */

function mapPage(design: Design, pageIndex: number, fn: (p: Page) => Page): Design {
  if (!design.pages[pageIndex]) return design;
  const pages = design.pages.slice();
  pages[pageIndex] = fn(pages[pageIndex]);
  return { ...design, pages };
}

export function mapElements(
  design: Design,
  pageIndex: number,
  fn: (elements: Element[]) => Element[],
): Design {
  return mapPage(design, pageIndex, (p) => ({ ...p, elements: fn(p.elements) }));
}

/** Change some elements, leave the rest alone, keep the z-order. */
export function patch(
  design: Design,
  pageIndex: number,
  ids: string[],
  fn: (el: Element) => Element,
): Design {
  const set = new Set(ids);
  return mapElements(design, pageIndex, (list) =>
    list.map((el) => (set.has(el.id) && !el.locked ? fn(el) : el)),
  );
}

/**
 * The same, but for one field on one kind of element.
 *
 * Typed loosely on purpose: the toolbar sets `size` on text and `fill` on
 * shapes through the same call, and the alternative is a switch in every
 * control. `patch` above still refuses to touch a locked element, which is
 * the check that actually matters.
 */
export function setField(
  design: Design,
  pageIndex: number,
  ids: string[],
  field: string,
  value: unknown,
): Design {
  return patch(design, pageIndex, ids, (el) =>
    field in el ? ({ ...el, [field]: value } as Element) : el,
  );
}

export function addElement(design: Design, pageIndex: number, el: Element): Design {
  return mapElements(design, pageIndex, (list) => [...list, el]);
}

export function removeElements(design: Design, pageIndex: number, ids: string[]): Design {
  const set = new Set(ids);
  return mapElements(design, pageIndex, (list) => list.filter((el) => !set.has(el.id) || el.locked));
}

/**
 * Copies, offset so they are visibly not the originals.
 *
 * New ids throughout, including a new group id when a whole group is copied —
 * otherwise the copy and the original would move together forever, which is
 * the bug every naive duplicate has.
 */
export function duplicateElements(
  design: Design,
  pageIndex: number,
  ids: string[],
): { design: Design; ids: string[] } {
  const page = design.pages[pageIndex];
  if (!page) return { design, ids: [] };

  const set = new Set(ids);
  const chosen = page.elements.filter((el) => set.has(el.id));
  if (!chosen.length) return { design, ids: [] };

  const groups = new Map<string, string>();
  const copies = chosen.map((el) => {
    const copy: Element = { ...el, id: newId(), x: el.x + 4, y: el.y + 4 };
    if (el.group) {
      if (!groups.has(el.group)) groups.set(el.group, newId());
      copy.group = groups.get(el.group);
    }
    return copy;
  });

  return {
    design: mapElements(design, pageIndex, (list) => [...list, ...copies]),
    ids: copies.map((c) => c.id),
  };
}

/* -------------------------------------------------------------- grouping */

export function group(design: Design, pageIndex: number, ids: string[]): Design {
  if (ids.length < 2) return design;
  const id = newId();
  const set = new Set(ids);
  return mapElements(design, pageIndex, (list) => {
    const inside = list.filter((el) => set.has(el.id)).map((el) => ({ ...el, group: id }));
    const outside = list.filter((el) => !set.has(el.id));
    // Members are brought together at the top of the stack. Leaving them
    // scattered would let a third element sit between two members of the same
    // group, which no design tool allows because it cannot be drawn.
    return [...outside, ...inside];
  });
}

export function ungroup(design: Design, pageIndex: number, ids: string[]): Design {
  const set = new Set(ids);
  return mapElements(design, pageIndex, (list) =>
    list.map((el) => {
      if (!set.has(el.id) || !el.group) return el;
      const { group: _drop, ...rest } = el;
      return rest as Element;
    }),
  );
}

/** Every element that moves when this one does. */
export function groupMates(page: Page, id: string): string[] {
  const el = page.elements.find((e) => e.id === id);
  if (!el) return [];
  if (!el.group) return [el.id];
  return page.elements.filter((e) => e.group === el.group).map((e) => e.id);
}

/* --------------------------------------------------------------- z-order */

export function layer(
  design: Design,
  pageIndex: number,
  ids: string[],
  where: "forward" | "backward" | "front" | "back",
): Design {
  return mapElements(design, pageIndex, (list) => {
    let next = list;
    // Front and forward are applied bottom-up so a multi-selection keeps its
    // internal order; back and backward top-down for the same reason.
    const order = where === "front" || where === "forward" ? ids : ids.slice().reverse();
    for (const id of order) next = reorder(next, id, where);
    return next;
  });
}

/* ------------------------------------------------------------- alignment */

export type AlignTo = "left" | "centre" | "right" | "top" | "middle" | "bottom";

/**
 * Align to each other, or to the page.
 *
 * One element aligns to the page, because "align left" with nothing to align
 * against can only mean the paper. Two or more align to their shared bounding
 * box, which is what somebody means when they have selected several things and
 * wants their edges to line up. Canva makes the same distinction silently.
 */
export function align(design: Design, pageIndex: number, ids: string[], to: AlignTo): Design {
  const page = design.pages[pageIndex];
  if (!page || !ids.length) return design;

  const set = new Set(ids);
  const chosen = page.elements.filter((el) => set.has(el.id));
  if (!chosen.length) return design;

  const frame =
    chosen.length > 1
      ? (unionBounds(chosen) ?? { x: 0, y: 0, w: A4.w, h: A4.h })
      : { x: 0, y: 0, w: A4.w, h: A4.h };

  return patch(design, pageIndex, ids, (el) => {
    const b = bounds(el);
    // Work in the rotated bounding box but write back the unrotated origin,
    // so a tilted element lines up by the edge you can actually see.
    const dx = el.x - b.x;
    const dy = el.y - b.y;
    switch (to) {
      case "left":
        return { ...el, x: frame.x + dx };
      case "centre":
        return { ...el, x: frame.x + (frame.w - b.w) / 2 + dx };
      case "right":
        return { ...el, x: frame.x + frame.w - b.w + dx };
      case "top":
        return { ...el, y: frame.y + dy };
      case "middle":
        return { ...el, y: frame.y + (frame.h - b.h) / 2 + dy };
      case "bottom":
        return { ...el, y: frame.y + frame.h - b.h + dy };
    }
  });
}

/* ----------------------------------------------------------------- pages */

export function addPage(design: Design, after: number): Design {
  const pages = design.pages.slice();
  pages.splice(after + 1, 0, blankPage(design.pages[after]?.background ?? "#ffffff"));
  return { ...design, pages };
}

export function duplicatePage(design: Design, index: number): Design {
  const page = design.pages[index];
  if (!page) return design;
  const copy: Page = {
    id: newId(),
    background: page.background,
    // New ids for the elements too. Two pages sharing element ids would make
    // "select this one" ambiguous the moment anything looked across pages.
    elements: page.elements.map((el) => ({ ...el, id: newId() })),
  };
  const pages = design.pages.slice();
  pages.splice(index + 1, 0, copy);
  return { ...design, pages };
}

export function removePage(design: Design, index: number): Design {
  // A design with no pages cannot be rendered or edited, so the last one
  // stays. Emptying it is available and is what somebody means anyway.
  if (design.pages.length <= 1) return design;
  return { ...design, pages: design.pages.filter((_, i) => i !== index) };
}

export function movePage(design: Design, from: number, to: number): Design {
  if (from === to || !design.pages[from]) return design;
  const pages = design.pages.slice();
  const [p] = pages.splice(from, 1);
  pages.splice(Math.max(0, Math.min(pages.length, to)), 0, p);
  return { ...design, pages };
}

/* ---------------------------------------------------------------- snapping */

export type Guide = { axis: "x" | "y"; at: number };

/**
 * Where a dragged box wants to land.
 *
 * Compares the three interesting lines on each axis — near edge, centre, far
 * edge — against the same three lines on every other element, plus the page's
 * own edges and centre. The closest match inside the threshold wins, and the
 * returned offset is applied to the whole drag so a multi-selection snaps as
 * one thing rather than fighting itself.
 *
 * The threshold is in millimetres of *paper* but is divided by the zoom by the
 * caller, so snapping feels the same at 40% and at 200%: about six screen
 * pixels of pull either way. A fixed paper threshold would be unusable when
 * zoomed out, where six millimetres is two pixels of travel.
 */
export function snap(
  moving: { x: number; y: number; w: number; h: number },
  others: { x: number; y: number; w: number; h: number }[],
  threshold: number,
): { dx: number; dy: number; guides: Guide[] } {
  const lines = (b: { x: number; y: number; w: number; h: number }) => ({
    x: [b.x, b.x + b.w / 2, b.x + b.w],
    y: [b.y, b.y + b.h / 2, b.y + b.h],
  });

  const targets = {
    x: [0, A4.w / 2, A4.w, ...others.flatMap((o) => lines(o).x)],
    y: [0, A4.h / 2, A4.h, ...others.flatMap((o) => lines(o).y)],
  };

  const mine = lines(moving);
  const guides: Guide[] = [];
  let dx = 0;
  let dy = 0;

  for (const axis of ["x", "y"] as const) {
    let best = threshold;
    let at = 0;
    let delta = 0;
    for (const line of mine[axis]) {
      for (const target of targets[axis]) {
        const gap = Math.abs(target - line);
        if (gap < best) {
          best = gap;
          delta = target - line;
          at = target;
        }
      }
    }
    if (best < threshold) {
      if (axis === "x") dx = delta;
      else dy = delta;
      guides.push({ axis, at });
    }
  }

  return { dx, dy, guides };
}

/* --------------------------------------------------------------- resizing */

export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

/**
 * A resize, done in the element's own frame.
 *
 * The pointer moves in page space; a rotated element resizes along its own
 * axes. So the pointer delta is rotated *into* the element's frame, the edges
 * move there, and the origin is corrected afterwards so the corner the person
 * is not dragging stays exactly where it was — which is the part that looks
 * broken if you skip it, because the element appears to swim away from the
 * cursor.
 *
 * `ratio` keeps the aspect, and the minimum stops an element from being
 * dragged inside out into negative width.
 */
export function resize(
  el: Element,
  handle: Handle,
  deltaX: number,
  deltaY: number,
  ratio: boolean,
): Element {
  const rad = (-(el.rot ?? 0) * Math.PI) / 180;
  const dx = deltaX * Math.cos(rad) - deltaY * Math.sin(rad);
  const dy = deltaX * Math.sin(rad) + deltaY * Math.cos(rad);

  const MIN = 3;
  let { x, y, w, h } = el;

  if (handle.includes("w")) {
    const next = Math.max(MIN, w - dx);
    x += w - next;
    w = next;
  }
  if (handle.includes("e")) w = Math.max(MIN, w + dx);
  if (handle.includes("n")) {
    const next = Math.max(MIN, h - dy);
    y += h - next;
    h = next;
  }
  if (handle.includes("s")) h = Math.max(MIN, h + dy);

  if (ratio && el.w > 0 && el.h > 0) {
    const scale = Math.max(w / el.w, h / el.h);
    const rw = el.w * scale;
    const rh = el.h * scale;
    if (handle.includes("w")) x += w - rw;
    if (handle.includes("n")) y += h - rh;
    w = rw;
    h = rh;
  }

  // Rotation happens about the centre, so moving an edge in the local frame
  // moves the centre in page space too. Put it back.
  if (el.rot) {
    const rad2 = ((el.rot ?? 0) * Math.PI) / 180;
    const oldC = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
    const newC = { x: x + w / 2, y: y + h / 2 };
    const off = { x: newC.x - oldC.x, y: newC.y - oldC.y };
    const rotated = {
      x: off.x * Math.cos(rad2) - off.y * Math.sin(rad2),
      y: off.x * Math.sin(rad2) + off.y * Math.cos(rad2),
    };
    x += rotated.x - off.x;
    y += rotated.y - off.y;
  }

  return { ...el, x, y, w, h };
}
