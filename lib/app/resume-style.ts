/**
 * What somebody changed by hand, on top of the template.
 *
 * The template decides how a resume looks and it is usually right. This is the
 * escape hatch for when it is not — a heading somebody wants in their old
 * firm's blue, a name they want bigger, a section they do not have and would
 * rather not show an empty heading for.
 *
 * Worth stating the cost plainly, because it is real and it is not obvious.
 * Every override here is a way to make a resume worse: six font sizes on one
 * page, a colour that vanishes when a recruiter prints in greyscale, a typeface
 * that is not one of the fourteen a PDF can rely on and gets substituted at
 * print time — which reflows a one-page resume onto two. None of that changes
 * the *text*, so none of it changes the ATS score, which is precisely why the
 * score cannot warn anybody about it. Sensible defaults and a short list of
 * fonts are the only protection there is.
 *
 * Keyed by the same path strings the editor uses — `roles.0.title` — so a
 * style and the field it belongs to are named identically in both directions.
 */

export type FieldStyle = {
  /** A family name from `FONTS`. Anything else is ignored. */
  font?: string;
  /** Points, as a number. Clamped to something a page can hold. */
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** `#rrggbb`. */
  color?: string;
  align?: "left" | "center" | "right";
  /** ALL CAPS, applied to the text layer rather than by CSS — see below. */
  caps?: boolean;
};

/**
 * How the photograph sits in its circle.
 *
 * A headshot is never framed the way a template's circle wants it — the face
 * is off-centre, or too far away, and a centre crop cuts the top of somebody's
 * head off. Three numbers fix it: how far in to zoom, and where to slide the
 * picture behind the hole.
 *
 * Offsets are percentages rather than pixels so they survive the same photo
 * being shown at 22mm in the document and 6mm in a gallery thumbnail.
 */
export type PhotoFit = {
  /* ---- the picture inside the hole (Canva's crop mode) ---- */
  /** 1 is fit-the-circle. Up to 3. */
  scale: number;
  /** -50 to 50, as a percentage of the frame. */
  x: number;
  y: number;

  /* ---- the hole itself (Canva's element selection) ---- */
  /**
   * The circle's diameter as a multiple of the template's own, 0.5 to 2.
   *
   * Separate from `scale` because they are different intentions and people
   * reach for them at different moments: one makes the picture bigger behind a
   * fixed hole, the other makes the hole bigger. Canva splits them by click
   * depth — one click selects the frame, two enters the crop — and conflating
   * them into a single "zoom" is what makes most photo editors frustrating.
   */
  frame: number;
  /** Where the circle sits, in millimetres from where the template put it. */
  frameX: number;
  frameY: number;
};

export const DEFAULT_PHOTO_FIT: PhotoFit = { scale: 1, x: 0, y: 0, frame: 1, frameX: 0, frameY: 0 };

export type Presentation = {
  fields: Record<string, FieldStyle>;
  /** Sections switched off. Section keys from resume-templates.ts. */
  hidden: string[];
  /** Absent until somebody adjusts the photo. */
  photoFit?: PhotoFit;
};

export const EMPTY_PRESENTATION: Presentation = { fields: {}, hidden: [] };

/** The path the photograph answers to, so it can be selected like a field. */
export const PHOTO_PATH = "photo";

/** The same element, in crop mode — the picture rather than the hole. */
export const PHOTO_CROP_PATH = "photo:crop";

/* ----------------------------------------------------------------- fonts */

/**
 * The list, and why it is a list.
 *
 * Google serves thousands of families. Offering all of them would mean a
 * picker nobody can navigate and a resume set in something that renders as
 * Times on the machine that opens it. These are chosen for being legible at
 * 10pt, widely used in documents, and available in the weights a resume needs.
 *
 * The first four are the PDF Core-14 families and their metric-compatible
 * substitutes: they need no download, cannot be substituted, and are the safe
 * default. Everything after them is a web font, which is fine on screen and in
 * a browser-printed PDF, and is the row to suspect if a document ever comes
 * out looking different somewhere else.
 */
export const FONTS: { name: string; stack: string; web?: boolean }[] = [
  { name: "Helvetica", stack: 'Helvetica, Arial, "Liberation Sans", sans-serif' },
  { name: "Times", stack: '"Times New Roman", Times, "Liberation Serif", serif' },
  { name: "Courier", stack: '"Courier New", Courier, monospace' },
  { name: "Georgia", stack: 'Georgia, "Liberation Serif", serif' },

  { name: "Inter", stack: '"Inter", Helvetica, Arial, sans-serif', web: true },
  { name: "Roboto", stack: '"Roboto", Helvetica, Arial, sans-serif', web: true },
  { name: "Open Sans", stack: '"Open Sans", Helvetica, Arial, sans-serif', web: true },
  { name: "Lato", stack: '"Lato", Helvetica, Arial, sans-serif', web: true },
  { name: "Montserrat", stack: '"Montserrat", Helvetica, Arial, sans-serif', web: true },
  { name: "Poppins", stack: '"Poppins", Helvetica, Arial, sans-serif', web: true },
  { name: "Work Sans", stack: '"Work Sans", Helvetica, Arial, sans-serif', web: true },
  { name: "Source Sans 3", stack: '"Source Sans 3", Helvetica, Arial, sans-serif', web: true },
  { name: "Nunito Sans", stack: '"Nunito Sans", Helvetica, Arial, sans-serif', web: true },
  { name: "IBM Plex Sans", stack: '"IBM Plex Sans", Helvetica, Arial, sans-serif', web: true },
  { name: "Merriweather", stack: '"Merriweather", Georgia, serif', web: true },
  { name: "Lora", stack: '"Lora", Georgia, serif', web: true },
  { name: "Playfair Display", stack: '"Playfair Display", Georgia, serif', web: true },
  { name: "Source Serif 4", stack: '"Source Serif 4", Georgia, serif', web: true },
  { name: "EB Garamond", stack: '"EB Garamond", Georgia, serif', web: true },
  { name: "Roboto Slab", stack: '"Roboto Slab", Georgia, serif', web: true },
];

export function fontStack(name: string | undefined): string | undefined {
  return FONTS.find((f) => f.name === name)?.stack;
}

/**
 * One stylesheet request for every web font in the list.
 *
 * All of them, always, rather than only the ones in use. A resume has a
 * handful of fields; loading the picker's whole list once is a single request
 * that caches, while loading them as somebody tries fonts means a flash of
 * fallback type on every click — and, worse, a print that fires before the
 * chosen font has arrived.
 */
export const GOOGLE_FONTS_HREF = `https://fonts.googleapis.com/css2?${FONTS.filter((f) => f.web)
  .map((f) => `family=${f.name.replace(/ /g, "+")}:wght@400;700`)
  .join("&")}&display=swap`;

/* -------------------------------------------------------------- sanitise */

const SIZE_MIN = 6;
const SIZE_MAX = 48;
const HEX = /^#[0-9a-f]{6}$/i;

/** Names that mean something to JavaScript rather than to a resume. */
const PROTO = new Set(["__proto__", "constructor", "prototype"]);

/**
 * What comes back from a browser is not to be trusted.
 *
 * Same posture as `cleanResume`: every field is checked by name, anything
 * unrecognised is dropped, and a value out of range is dropped rather than
 * clamped. A 400pt font size is not somebody wanting very large text, it is a
 * bug or a probe, and silently turning it into 48 hides which.
 */
export function cleanPresentation(value: unknown): Presentation {
  if (!value || typeof value !== "object") return { fields: {}, hidden: [] };
  const raw = value as { fields?: unknown; hidden?: unknown };

  /**
   * A plain object, and it has to be one.
   *
   * This was `Object.create(null)` for about an hour — belt as well as braces
   * on top of the `PROTO` check below. It is also a 500: React's server
   * serializer requires `getPrototypeOf(value) === Object.prototype` for
   * anything crossing into a client component, and a null-prototyped object
   * fails that check at request time rather than at build time. The builder
   * page went blank with "a server error occurred" and nothing in the code
   * looked wrong.
   *
   * The braces were the belt anyway: rejecting the three dangerous segment
   * names below is what actually stops prototype pollution, and there is a
   * test for it.
   */
  const fields: Record<string, FieldStyle> = {};
  if (raw.fields && typeof raw.fields === "object") {
    for (const [path, style] of Object.entries(raw.fields as Record<string, unknown>)) {
      // Paths are what the document puts on the DOM and what the editor reads
      // back. Anything else in this map is not addressing a real field.
      if (!/^[A-Za-z_]+(\.[A-Za-z0-9_]+)*$/.test(path)) continue;
      // And nothing that names a prototype slot. `fields["__proto__"] = …` is
      // an assignment to the object's prototype rather than to a key on it —
      // the shape of prototype pollution, arriving through a field somebody
      // can name. The pattern above happily allowed it, which a test caught.
      if (path.split(".").some((part) => PROTO.has(part))) continue;
      const clean = cleanStyle(style);
      if (clean) fields[path] = clean;
    }
  }

  const hidden = Array.isArray(raw.hidden)
    ? [...new Set(raw.hidden.filter((h): h is string => typeof h === "string" && h.length < 40))]
    : [];

  const photoFit = cleanFit((value as { photoFit?: unknown }).photoFit);

  return { fields, hidden, ...(photoFit ? { photoFit } : {}) };
}

function cleanFit(value: unknown): PhotoFit | null {
  if (!value || typeof value !== "object") return null;
  const f = value as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;

  const scale = num(f.scale, 1, 3);
  const x = num(f.x, -50, 50);
  const y = num(f.y, -50, 50);
  if (scale === null || x === null || y === null) return null;

  // The frame half is newer than the crop half, so a row written before it
  // existed is missing it. Defaulted rather than rejected: an old photograph
  // should keep its crop, not lose it because the shape grew.
  const frame = num(f.frame, 0.5, 2) ?? 1;
  const frameX = num(f.frameX, -40, 40) ?? 0;
  const frameY = num(f.frameY, -40, 40) ?? 0;

  // Rounded, because these come from a slider and a drag: storing 1.0400000001
  // makes every save look like a change and fills the undo stack.
  return {
    scale: Math.round(scale * 100) / 100,
    x: Math.round(x),
    y: Math.round(y),
    frame: Math.round(frame * 100) / 100,
    frameX: Math.round(frameX * 10) / 10,
    frameY: Math.round(frameY * 10) / 10,
  };
}

/** The picture, inside its hole. */
export function photoCss(fit: PhotoFit | undefined): React.CSSProperties {
  const f = fit ?? DEFAULT_PHOTO_FIT;
  return {
    // `objectPosition` moves the crop inside the circle; `scale` zooms in. Two
    // properties rather than one transform, so the circle itself never moves
    // and the layout around it cannot shift.
    objectPosition: `${50 + f.x}% ${50 + f.y}%`,
    transform: f.scale === 1 ? undefined : `scale(${f.scale})`,
  };
}

/**
 * The hole itself.
 *
 * `translate` rather than margins, so moving the circle never reflows the text
 * beside it — the same reason the crop uses object-position. A resume where
 * nudging a photograph reruns the layout is a resume that repaginates while
 * somebody is looking at it.
 */
export function photoFrameCss(fit: PhotoFit | undefined): React.CSSProperties {
  const f = fit ?? DEFAULT_PHOTO_FIT;
  return {
    width: `calc(22mm * ${f.frame})`,
    height: `calc(22mm * ${f.frame})`,
    transform:
      f.frameX || f.frameY ? `translate(${f.frameX}mm, ${f.frameY}mm)` : undefined,
  };
}

function cleanStyle(value: unknown): FieldStyle | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const out: FieldStyle = {};

  if (typeof s.font === "string" && fontStack(s.font)) out.font = s.font;
  if (typeof s.size === "number" && Number.isFinite(s.size) && s.size >= SIZE_MIN && s.size <= SIZE_MAX) {
    out.size = Math.round(s.size * 2) / 2;
  }
  if (s.bold === true) out.bold = true;
  if (s.italic === true) out.italic = true;
  if (s.underline === true) out.underline = true;
  if (s.caps === true) out.caps = true;
  if (typeof s.color === "string" && HEX.test(s.color)) out.color = s.color.toLowerCase();
  if (s.align === "left" || s.align === "center" || s.align === "right") out.align = s.align;

  // An empty override is not an override. Dropping it keeps the blob from
  // filling with `{}` for every field somebody clicked into and left alone.
  return Object.keys(out).length ? out : null;
}

/** The style as CSS, for the one span it belongs to. */
export function styleToCss(style: FieldStyle | undefined): React.CSSProperties | undefined {
  if (!style) return undefined;
  const css: React.CSSProperties = {};

  const stack = fontStack(style.font);
  if (stack) css.fontFamily = stack;
  if (style.size) css.fontSize = `${style.size}pt`;
  if (style.bold !== undefined) css.fontWeight = style.bold ? 700 : 400;
  if (style.italic) css.fontStyle = "italic";
  if (style.underline) css.textDecoration = "underline";
  if (style.color) css.color = style.color;
  if (style.align) css.textAlign = style.align;
  // Deliberately not `text-transform`. CSS capitals leave the text layer
  // lowercase, so a heading somebody made uppercase would still come out of
  // the PDF as "summary" — the editor uppercases the stored string instead.
  return css;
}

/** The swatches the picker opens with. Dark enough to print. */
export const SWATCHES = [
  "#000000", "#1f2937", "#374151", "#6b7280",
  "#1e3a5f", "#2f5bd6", "#14706b", "#3f5a4c",
  "#5c1f45", "#8d4f38", "#7c2d12", "#4c1d95",
];
