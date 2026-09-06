/**
 * What a design *is*.
 *
 * The resume builder used to store a typed résumé — name, roles, bullets —
 * and paint it through one of ten layouts. That made the score honest and the
 * document rigid: you could change the words and nothing else. This is the
 * other bargain. A design is now a stack of pages, and a page is a list of
 * objects with positions. Anything can be moved, resized, restyled, layered,
 * grouped or deleted, because that is what people mean when they say "like
 * Canva".
 *
 * The résumé content does not disappear — it is what a new design is seeded
 * from, and text can be read back out of the elements in reading order when
 * the ATS check is built as its own thing. But it stops being the master
 * copy. After the first paint, the design is the document.
 *
 * ---------------------------------------------------------------- the units
 *
 * Millimetres, everywhere, for geometry. Not pixels.
 *
 * A page is a physical object that ends up on A4, and every pixel figure
 * would need a scale factor attached to it — one for the screen, another for
 * zoom, a third for the PDF — and the moment two of those disagree the
 * preview stops matching the download. In millimetres the numbers *are* the
 * paper: an element at x=20 is two centimetres from the left edge on screen,
 * in the export, and on the page that comes out of the printer.
 *
 * Type size is the exception and is in points, because that is the unit
 * typography actually uses and the number a person expects to see when they
 * click into a font-size box. 1pt = 0.3528mm; `PT` does the conversion in the
 * one place that needs it.
 *
 * ------------------------------------------------------------- what is here
 *
 * Types, factories, geometry, and `cleanDesign` — the gate every design
 * passes through on its way out of a browser. Rendering lives in
 * DesignPage.tsx and interaction in the editor; this file knows nothing about
 * either, so a test can run the whole model without a DOM.
 */

/* --------------------------------------------------------------- the page */

/** A4, in millimetres. The only page size for now; the field exists so the
 *  day a second one is added, nothing has to be found and replaced. */
export const A4 = { w: 210, h: 297 } as const;

/** Points to millimetres. 72pt to the inch, 25.4mm to the inch. */
export const PT = 25.4 / 72;

/* ------------------------------------------------------------- the objects */

export type ElementType = "text" | "image" | "shape" | "line";

export type Align = "left" | "center" | "right" | "justify";
export type ListStyle = "none" | "bullet" | "number";
export type ShapeKind = "rect" | "ellipse" | "triangle" | "diamond";
export type ImageShape = "rect" | "circle";

/** What every element has, whatever it is. */
type Base = {
  id: string;
  /** Top-left corner and size, in millimetres, before rotation. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees clockwise about the centre. */
  rot: number;
  /** 0–1. Applied by the renderer as CSS opacity. */
  opacity: number;
  /** Locked elements ignore every pointer and keyboard edit until unlocked. */
  locked: boolean;
  /**
   * Which group this belongs to, if any.
   *
   * Flat rather than nested on purpose. A tree of groups means every hit
   * test, drag and resize has to walk and compose transforms, and the one
   * thing it buys — groups inside groups — is not what anybody is doing on a
   * one-page résumé. Selecting any member selects the whole group; a
   * double-click steps inside and selects the one element under the cursor,
   * which is exactly what Canva does and is the case people actually hit.
   */
  group?: string;
};

export type TextElement = Base & {
  type: "text";
  /** Plain text. Newlines are line breaks; there is no inline markup. */
  text: string;
  font: string;
  /** Points. */
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  caps: boolean;
  color: string;
  align: Align;
  /** Multiple of the type size, the way every design tool states it. */
  lineHeight: number;
  /** Fraction of an em. */
  letterSpacing: number;
  list: ListStyle;
  /**
   * Whether the box grows to fit the words.
   *
   * On for text somebody typed, so a paragraph that gets longer does not
   * quietly hide its own last line; off once they have dragged a side handle,
   * because at that point they have said what width they want and the height
   * is theirs to set. Canva makes the same distinction and never explains it,
   * which is the sign it is the right default.
   */
  autoHeight: boolean;
};

/**
 * A picture, or a place for one.
 *
 * The element is the *frame*; the picture is its contents. That split is the
 * whole design and it comes straight from how Canva behaves: a frame has a
 * position, a size, a shape and a place in the layer order, and swapping the
 * photo inside it changes none of those. Modelling the photo as the element
 * instead would make "replace this picture" mean "delete this element and
 * make a new one", which loses every one of those properties.
 *
 * It also gives the empty state for free. `src: null` is a frame waiting for
 * a photo — the state a template ships with, so somebody opening a résumé
 * sees where their picture goes before they have one.
 */
export type ImageElement = Base & {
  type: "image";
  /**
   * A data URL, compressed in the browser before it ever gets here — or null
   * for an empty frame that has not been filled yet.
   */
  src: string | null;
  /**
   * Where the picture sits inside its frame: the crop, in three numbers.
   *
   * `scale` is relative to "just covers the frame", so 1 always fills it and
   * anything above 1 is zoomed in. `x` and `y` are percentages in the sense
   * CSS `object-position` uses them, which is what makes the constraint in
   * `coverFit` expressible at all: 0 and 100 are the two edges, so keeping the
   * picture over the hole is just a clamp.
   */
  fit: { scale: number; x: number; y: number };
  shape: ImageShape;
  /** Corner radius in millimetres. Ignored when the shape is a circle. */
  radius: number;
  flipX: boolean;
  flipY: boolean;
};

/**
 * A fit that cannot leave a gap inside the frame.
 *
 * The spec asks for this directly — the frame must stay filled, no empty
 * corners — and it is the one image rule that has to live in the model rather
 * than in the interaction code. A drag, a slider, a wheel gesture and a
 * pasted document are four different ways to set the same three numbers, and
 * a rule enforced in only three of them is not a rule.
 *
 * The rule turns out to be two clamps, and it is worth writing down why it is
 * not more than that. The picture is laid in with `object-fit: cover`, which
 * already sizes it to be *at least* as big as the frame on both axes — so it
 * always overflows, and `object-position` only slides it along that overflow.
 * Anywhere in 0–100% is therefore covered by construction; it is only values
 * outside that range that would pull an edge into view. `transform: scale()`
 * on top makes the picture larger still, so it can only ever add slack.
 *
 * Which leaves exactly two ways to open a gap: a position outside 0–100, or a
 * scale below 1 that shrinks the picture back inside the hole. Both are shut
 * here rather than in the four different places that set these numbers — a
 * drag, a slider, a wheel gesture and a pasted document are all the same
 * three fields, and a rule enforced in three of them is not a rule.
 */
export function coverFit(fit: ImageElement["fit"]): ImageElement["fit"] {
  const range = (v: number, min: number, max: number, fallback: number) =>
    Math.min(max, Math.max(min, Number.isFinite(v) ? v : fallback));

  return {
    scale: range(fit.scale, 1, 8, 1),
    x: range(fit.x, 0, 100, 50),
    y: range(fit.y, 0, 100, 50),
  };
}

export type ShapeElement = Base & {
  type: "shape";
  shape: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
};

export type LineElement = Base & {
  type: "line";
  stroke: string;
  strokeWidth: number;
  /** A rule, a dashed rule, or a dotted one. */
  dash: "solid" | "dashed" | "dotted";
};

export type Element = TextElement | ImageElement | ShapeElement | LineElement;

export type Page = {
  id: string;
  /** Painted behind everything. A page always has one, even if it is white. */
  background: string;
  /** Back to front. The last element in the list is the one on top. */
  elements: Element[];
};

export type Design = {
  /** Bumped when the shape changes in a way old rows cannot be read as. */
  version: 1;
  pages: Page[];
};

/* ------------------------------------------------------------------ making */

/**
 * Ids.
 *
 * `crypto.randomUUID` where it exists — every browser we support and every
 * runtime this can run in — and a counter-and-random fallback so a test in a
 * bare context does not have to stub a global. Short, because these end up in
 * a jsonb blob a few hundred times over and in React keys.
 */
let seq = 0;
export function newId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID().slice(0, 8);
  seq += 1;
  return `e${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const BASE = { rot: 0, opacity: 1, locked: false } as const;

export const DEFAULT_TEXT = {
  font: "Inter",
  size: 11,
  bold: false,
  italic: false,
  underline: false,
  caps: false,
  color: "#111111",
  align: "left" as Align,
  lineHeight: 1.35,
  letterSpacing: 0,
  list: "none" as ListStyle,
  autoHeight: true,
};

export function text(partial: Partial<TextElement> & { text: string }): TextElement {
  return {
    ...BASE,
    ...DEFAULT_TEXT,
    id: newId(),
    type: "text",
    x: 20,
    y: 20,
    w: 80,
    h: 10,
    ...partial,
  };
}

export function image(partial: Partial<ImageElement> = {}): ImageElement {
  return {
    ...BASE,
    id: newId(),
    type: "image",
    src: null,
    x: 20,
    y: 20,
    w: 40,
    h: 40,
    fit: { scale: 1, x: 50, y: 50 },
    shape: "rect",
    radius: 0,
    flipX: false,
    flipY: false,
    ...partial,
  };
}

export function shape(partial: Partial<ShapeElement> = {}): ShapeElement {
  return {
    ...BASE,
    id: newId(),
    type: "shape",
    shape: "rect",
    x: 20,
    y: 20,
    w: 40,
    h: 30,
    fill: "#2f3640",
    stroke: "transparent",
    strokeWidth: 0,
    radius: 0,
    ...partial,
  };
}

export function line(partial: Partial<LineElement> = {}): LineElement {
  return {
    ...BASE,
    id: newId(),
    type: "line",
    x: 20,
    y: 20,
    w: 60,
    h: 0.4,
    stroke: "#111111",
    strokeWidth: 0.4,
    dash: "solid",
    ...partial,
  };
}

export function blankPage(background = "#ffffff"): Page {
  return { id: newId(), background, elements: [] };
}

export function blankDesign(): Design {
  return { version: 1, pages: [blankPage()] };
}

/* -------------------------------------------------------------- geometry */

export type Box = { x: number; y: number; w: number; h: number };

/**
 * The axis-aligned box a rotated element actually occupies.
 *
 * Needed by three different things that all get it wrong if they use `x,y,w,h`
 * directly: the marquee (a tilted element overlaps a rectangle its corners
 * reach, not its unrotated box), snapping, and multi-select bounds. Standard
 * result — half-extents projected onto each axis.
 */
export function bounds(e: Box & { rot?: number }): Box {
  const rot = e.rot ?? 0;
  if (!rot) return { x: e.x, y: e.y, w: e.w, h: e.h };
  const rad = (rot * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  const w = e.w * c + e.h * s;
  const h = e.w * s + e.h * c;
  return { x: e.x + (e.w - w) / 2, y: e.y + (e.h - h) / 2, w, h };
}

/** The box that contains all of them. Null for an empty selection. */
export function unionBounds(list: (Box & { rot?: number })[]): Box | null {
  if (!list.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const e of list) {
    const b = bounds(e);
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Is this point inside this element?
 *
 * The point is rotated *backwards* about the element's centre and then tested
 * against the unrotated box, which is the cheap way to hit-test a rotated
 * rectangle and avoids four cross products. A line gets a minimum thickness
 * so a 0.4mm rule is still clickable — the alternative is a control the user
 * can see and cannot hit.
 */
export function hits(e: Element, px: number, py: number): boolean {
  const cx = e.x + e.w / 2;
  const cy = e.y + e.h / 2;
  let lx = px;
  let ly = py;
  if (e.rot) {
    const rad = (-e.rot * Math.PI) / 180;
    const dx = px - cx;
    const dy = py - cy;
    lx = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
    ly = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
  }
  const pad = e.type === "line" ? Math.max(0, (2 - e.h) / 2) : 0;
  return (
    lx >= e.x && lx <= e.x + e.w && ly >= e.y - pad && ly <= e.y + e.h + pad
  );
}

/* --------------------------------------------------------------- z-order */

/** Move one element through the stack. The list order *is* the z-order. */
export function reorder(
  elements: Element[],
  id: string,
  where: "forward" | "backward" | "front" | "back",
): Element[] {
  const i = elements.findIndex((e) => e.id === id);
  if (i < 0) return elements;
  const next = elements.slice();
  const [el] = next.splice(i, 1);
  const to =
    where === "front"
      ? next.length
      : where === "back"
        ? 0
        : where === "forward"
          ? Math.min(next.length, i + 1)
          : Math.max(0, i - 1);
  next.splice(to, 0, el);
  return next;
}

/* ------------------------------------------------------------------ gate */

/**
 * Everything a browser sends, made safe.
 *
 * This is the only way a design gets into the database, and it is written as
 * a rebuild rather than a validation: every field is read out, checked, and
 * written into a fresh plain object. Nothing from the input survives except
 * values that passed, which means a key nobody thought of cannot ride along.
 *
 * Plain objects and arrays, deliberately — `Object.create(null)` here cost an
 * afternoon once, because React's server serializer refuses any prototype but
 * `Object.prototype` and fails at request time rather than at build.
 *
 * The caps are not arbitrary. They are what stops one pasted document from
 * becoming a row nothing can load: 40 pages, 400 elements a page, 20k
 * characters of text in one box, 3MB of data URL per image.
 */
const MAX_PAGES = 40;
const MAX_ELEMENTS = 400;
const MAX_TEXT = 20_000;
const MAX_SRC = 3_000_000;

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function str(v: unknown, fallback: string, max: number): string {
  return typeof v === "string" && v.length <= max ? v : fallback;
}

function bool(v: unknown): boolean {
  return v === true;
}

/**
 * A colour, or nothing.
 *
 * Only shapes we can name: #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() with plain
 * numbers, and the two keywords that mean "none". Everything else is dropped
 * rather than escaped — a colour field is a CSS value that lands in a `style`
 * attribute, and `url(...)` in a `background` is the kind of thing that turns
 * a résumé into somebody else's beacon.
 */
const COLOUR = /^(#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)|transparent|currentColor)$/i;

function colour(v: unknown, fallback: string): string {
  return typeof v === "string" && COLOUR.test(v.trim()) ? v.trim() : fallback;
}

/** A data URL for a picture, and nothing else — never a remote or blob URL. */
function src(v: unknown): string | null {
  if (typeof v !== "string" || v.length > MAX_SRC) return null;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
}

function one<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function cleanElement(raw: unknown): Element | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const base = {
    id: str(r.id, newId(), 64) || newId(),
    // Elements are allowed off the page — Canva lets you drag something half
    // over the edge and so does this — but not so far that a person can lose
    // it somewhere they cannot scroll to.
    x: num(r.x, 0, -A4.w, A4.w * 2),
    y: num(r.y, 0, -A4.h, A4.h * 2),
    w: num(r.w, 20, 0.2, A4.w * 2),
    h: num(r.h, 10, 0.2, A4.h * 2),
    rot: num(r.rot, 0, -360, 360),
    opacity: num(r.opacity, 1, 0, 1),
    locked: bool(r.locked),
    ...(typeof r.group === "string" && r.group.length <= 64 ? { group: r.group } : {}),
  };

  switch (r.type) {
    case "text":
      return {
        ...base,
        type: "text",
        text: str(r.text, "", MAX_TEXT),
        font: str(r.font, DEFAULT_TEXT.font, 64),
        size: num(r.size, DEFAULT_TEXT.size, 4, 400),
        bold: bool(r.bold),
        italic: bool(r.italic),
        underline: bool(r.underline),
        caps: bool(r.caps),
        color: colour(r.color, DEFAULT_TEXT.color),
        align: one(r.align, ["left", "center", "right", "justify"] as const, "left"),
        lineHeight: num(r.lineHeight, DEFAULT_TEXT.lineHeight, 0.6, 4),
        letterSpacing: num(r.letterSpacing, 0, -0.2, 2),
        list: one(r.list, ["none", "bullet", "number"] as const, "none"),
        autoHeight: r.autoHeight !== false,
      };

    case "image": {
      // No `src` is an empty frame, not a broken element. Refusing it here
      // would delete every unfilled photo container the moment a document
      // round-tripped through the gate.
      const f = (r.fit ?? {}) as Record<string, unknown>;
      return {
        ...base,
        type: "image",
        src: src(r.src),
        // Rebuilt through the same constraint the editor uses, so a document
        // that arrived with a gap in a frame comes back without one.
        fit: coverFit({
          scale: num(f.scale, 1, 1, 8),
          x: num(f.x, 50, 0, 100),
          y: num(f.y, 50, 0, 100),
        }),
        shape: one(r.shape, ["rect", "circle"] as const, "rect"),
        radius: num(r.radius, 0, 0, 100),
        flipX: bool(r.flipX),
        flipY: bool(r.flipY),
      };
    }

    case "shape":
      return {
        ...base,
        type: "shape",
        shape: one(r.shape, ["rect", "ellipse", "triangle", "diamond"] as const, "rect"),
        fill: colour(r.fill, "#2f3640"),
        stroke: colour(r.stroke, "transparent"),
        strokeWidth: num(r.strokeWidth, 0, 0, 40),
        radius: num(r.radius, 0, 0, 100),
      };

    case "line":
      return {
        ...base,
        type: "line",
        stroke: colour(r.stroke, "#111111"),
        strokeWidth: num(r.strokeWidth, 0.4, 0.1, 40),
        dash: one(r.dash, ["solid", "dashed", "dotted"] as const, "solid"),
      };

    default:
      return null;
  }
}

export function cleanDesign(raw: unknown): Design {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pages = Array.isArray(r.pages) ? r.pages.slice(0, MAX_PAGES) : [];

  const clean: Page[] = [];
  for (const p of pages) {
    if (!p || typeof p !== "object") continue;
    const pr = p as Record<string, unknown>;
    const list = Array.isArray(pr.elements) ? pr.elements.slice(0, MAX_ELEMENTS) : [];
    const elements: Element[] = [];
    // Ids have to be unique inside a page or selection picks two things at
    // once and undo restores the wrong one. A duplicate is renamed rather
    // than dropped, because losing somebody's element is the worse failure.
    const seen = new Set<string>();
    for (const item of list) {
      const el = cleanElement(item);
      if (!el) continue;
      if (seen.has(el.id)) el.id = newId();
      seen.add(el.id);
      elements.push(el);
    }
    clean.push({
      id: str(pr.id, newId(), 64) || newId(),
      background: colour(pr.background, "#ffffff"),
      elements,
    });
  }

  // A design with no pages is not a document anybody can work in, and the
  // editor would have nothing to render. One blank page is the floor.
  return { version: 1, pages: clean.length ? clean : [blankPage()] };
}

/** True when nothing has been put on the page yet. */
export function designIsEmpty(d: Design): boolean {
  return d.pages.every((p) => p.elements.length === 0);
}

/* ------------------------------------------------------------ reading out */

/**
 * The words, in the order somebody reads them.
 *
 * Top to bottom, then left to right, with a tolerance so two headings on the
 * same line do not swap because one sits a hair higher. This is what the ATS
 * check will parse when it is built as its own feature, and what "copy the
 * text" hands to an application form. It lives here, next to the model,
 * rather than in the checker — the order text is read in is a property of the
 * page, not of whoever happens to be reading it.
 */
export function designText(d: Design): string {
  return d.pages
    .map((page) =>
      page.elements
        .filter((e): e is TextElement => e.type === "text" && e.text.trim().length > 0)
        .slice()
        .sort((a, b) => (Math.abs(a.y - b.y) < 4 ? a.x - b.x : a.y - b.y))
        .map((e) => e.text)
        .join("\n"),
    )
    .join("\n\n")
    .trim();
}
