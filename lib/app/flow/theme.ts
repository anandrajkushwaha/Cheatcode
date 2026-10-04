import { templateById, showsPhoto, type Layout, type Template } from "@/lib/app/resume-templates";

/**
 * A template's look, as numbers and colours the renderer can do arithmetic on.
 *
 * The templates already carry their design — `theme.size` is "10pt",
 * `sectionGap` is "6mm" — but as strings meant to be dropped into CSS. A flow
 * engine has to add them up to know where a page ends, so they are parsed
 * once here and never read as text again.
 *
 * Everything the person can change lives in `Overrides`, and every layout
 * reads the result through CSS custom properties. That is the whole reason a
 * single accent-colour slider can repaint a document: nothing downstream
 * holds a colour of its own.
 */
export type FlowTheme = {
  /** The named structure this template came from. Decoration reads it. */
  layout: Layout;
  /** What that structure is, as geometry the renderer can lay out. */
  shape: Shape;

  font: string;
  /** The one colour the template gets to use. */
  accent: string;
  /** Text on top of the accent, when the accent is a fill. */
  onAccent: string;
  /** A fill for the narrow column, or a band that is not the accent itself. */
  wash: string;
  /** Text inside the narrow column, which may sit on a dark fill. */
  asideText: string;
  asideHeading: string;
  /** Section headings in the main column. */
  h2Color: string;
  /** Dates, institutions, the quiet half of a line. */
  muted: string;
  /** The hairline under a heading, as a CSS border shorthand. */
  rule: string;

  /** Body size, in points. */
  base: number;
  lead: number;
  align: "left" | "center";

  /** The name at the top, in points. */
  nameSize: number;
  nameWeight: number;
  nameTracking: string;
  nameCase: "none" | "uppercase";

  h2Size: number;
  h2Weight: number;
  h2Tracking: string;

  /** Multiplies every gap. 1 is the template's own spacing. */
  density: number;
  /** Multiplies every type size. 1 is the template's own scale. */
  scale: number;
  /** Space between sections, in millimetres, before density is applied. */
  sectionGap: number;
  /** Space between one job and the next. */
  roleGap: number;

  /** Whether this design reserves a frame for a portrait. */
  photo: boolean;
  /** Draw skills as meters rather than a list. */
  skillMeters: boolean;
};

/**
 * Fourteen named layouts, one description.
 *
 * The templates differ in a hundred details, but structurally a résumé is a
 * header, one wide column, and sometimes a narrow one beside it. Everything
 * else — rules, timelines, boxed headings, a band at the foot — is paint that
 * rides on that, so the renderer lays out one thing and then decorates it.
 *
 * Every field below is copied from the design each layout was seeded from
 * rather than invented, so a template somebody already picked keeps the
 * proportions they picked it for. The numbers are millimetres.
 */
export type Shape = {
  /**
   * Where the name goes. `plain` is the top of the wide column, `band` is a
   * full-bleed block of colour above both columns, `aside` is the top of the
   * narrow one — which is a real difference, not a detail: it decides what a
   * person reads first, and it is what the scorer is told.
   */
  header: "plain" | "band" | "aside";
  aside: "none" | "left" | "right";
  asideMm: number;
  /** The narrow column is a painted panel. */
  asideFill: boolean;
  /** A hairline between the columns instead of a fill. */
  asideRule: boolean;
  /**
   * The panel runs the whole height of the page, so the header sits *inside*
   * a column rather than above both. The difference is visible immediately:
   * a full-height sidebar starts at the paper's edge, a half-height one
   * starts under the name.
   */
  asideFullHeight: boolean;
  /** The band carries the summary as well as the name. */
  bandSummary: boolean;
  /** A block of colour across the foot of every page. */
  footerBand: boolean;
  /** Section headings in a gutter to the left of the text. */
  labelGutter: boolean;
  /** Each heading in a tinted panel. */
  boxed: boolean;
  /** Dated entries hung off one vertical rail. */
  rail: boolean;
  /** A square block beside the name rather than a round frame. */
  squarePhoto: boolean;
};

const S = (s: Partial<Shape>): Shape => ({
  header: "plain",
  aside: "none",
  asideMm: 0,
  asideFill: false,
  asideRule: false,
  asideFullHeight: false,
  bandSummary: false,
  footerBand: false,
  labelGutter: false,
  boxed: false,
  rail: false,
  squarePhoto: false,
  ...s,
});

const SHAPES: Record<Layout, Shape> = {
  column: S({}),
  boxed: S({ boxed: true }),
  "label-left": S({ labelGutter: true }),
  "rail-timeline": S({ rail: true }),
  "initial-block": S({ aside: "left", asideMm: 56, squarePhoto: true }),
  "footer-band": S({ aside: "left", asideMm: 56, footerBand: true }),
  band: S({ header: "band" }),
  "top-banner": S({ header: "band", aside: "left", asideMm: 58, bandSummary: true }),
  "header-photo": S({ header: "band", aside: "left", asideMm: 60 }),
  sidebar: S({ header: "aside", aside: "left", asideMm: 66, asideFill: true, asideFullHeight: true }),
  "photo-sidebar": S({ aside: "left", asideMm: 68, asideFill: true, asideFullHeight: true }),
  split: S({ aside: "left", asideMm: 62, asideFill: true }),
  "rule-split": S({ aside: "left", asideMm: 64, asideRule: true }),
  "right-sidebar": S({ aside: "right", asideMm: 62, asideFill: true, asideFullHeight: true }),
};

/**
 * The four shapes, named, for the places that only need the coarse answer —
 * a thumbnail, a filter, a sentence in the design panel.
 */
export type Family = "single" | "aside-left" | "aside-right" | "band";

export function familyOfShape(s: Shape): Family {
  if (s.aside === "left") return "aside-left";
  if (s.aside === "right") return "aside-right";
  return s.header === "band" ? "band" : "single";
}

export function shapeOf(templateId: string | null | undefined): Shape {
  const t = templateById(templateId);
  const base = SHAPES[t.layout] ?? SHAPES.column;
  const own = t.theme.asideMm;
  return typeof own === "number" && own > 0 && base.aside !== "none"
    ? { ...base, asideMm: own }
    : base;
}

export function familyOf(templateId: string | null | undefined): Family {
  return familyOfShape(shapeOf(templateId));
}

export type Overrides = Partial<{
  accent: string;
  font: string;
  scale: number;
  density: number;
}>;

const num = (v: string | number | undefined, fallback: number): number => {
  if (typeof v === "number") return v;
  const n = Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim() ? v : fallback;

export function flowTheme(templateId: string | null | undefined, o: Overrides = {}): FlowTheme {
  const t: Template = templateById(templateId);
  const th = t.theme;
  const layout = t.layout;
  const shape = shapeOf(t.id);

  const accent = o.accent ?? str(th.accent, "#111111");
  const base = num(th.size, 10);
  // A wash is only a default when something is actually filled. A sidebar with
  // no wash named is a dark column; a band with none is the accent itself.
  const wash = str(th.wash, shape.header === "band" && shape.aside === "none" ? accent : "#2f3640");
  // White on a pale wash is the one way these templates go invisible, so the
  // fallback follows the fill rather than being a constant.
  const asideText = str(th.asideText, isLight(wash) ? "#1a1a1a" : "#ffffff");

  return {
    layout,
    shape,
    font: o.font ?? str(th.font, "ui-sans-serif, system-ui, sans-serif"),
    accent,
    onAccent: str(th.onAccent, "#ffffff"),
    wash,
    asideText,
    asideHeading: str(th.asideHeading, isLight(wash) ? accent : asideText),
    h2Color: str(th.h2Color, accent),
    muted: str(th.muted, "#6b6b6b"),
    rule: str(th.h2Rule, "0.4pt solid currentColor"),

    base,
    lead: num(th.lead, 1.45),
    align: th.align === "center" ? "center" : "left",

    nameSize: num(th.nameSize, 20),
    nameWeight: num(th.nameWeight, 700),
    nameTracking: str(th.nameTracking, "-0.01em"),
    nameCase: th.nameCase === "uppercase" ? "uppercase" : "none",

    h2Size: num(th.h2Size, base - 1.5),
    h2Weight: num(th.h2Weight, 700),
    h2Tracking: str(th.h2Tracking, "0.12em"),

    density: o.density ?? 1,
    scale: o.scale ?? 1,
    sectionGap: num(th.sectionGap, 6),
    roleGap: num(th.roleGap, 3.5),

    photo: showsPhoto(t),
    skillMeters: th.skillMeters === true,
  };
}

/**
 * Is this fill pale enough that white text would vanish on it?
 *
 * Rough on purpose — it decides a fallback, never an override a template set
 * by hand. Relative luminance would be more correct and would not change any
 * answer this is asked, because the washes are either near-white or near-black.
 */
function isLight(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = Number.parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

/**
 * The tokens, as CSS. Layouts read only these — never a template object — so
 * a change here reaches every element in the document at once.
 */
export function themeStyle(t: FlowTheme): React.CSSProperties {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...({
      "--r-font": t.font,
      "--r-accent": t.accent,
      "--r-on-accent": t.onAccent,
      "--r-wash": t.wash,
      "--r-text": "#111111",
      "--r-muted": t.muted,
      "--r-base": `${t.base * t.scale}pt`,
      "--r-lead": String(t.lead),
      "--r-name": `${t.nameSize * t.scale}pt`,
      "--r-name-weight": String(t.nameWeight),
      "--r-name-tracking": t.nameTracking,
      "--r-name-case": t.nameCase,
      "--r-h2": `${t.h2Size * t.scale}pt`,
      "--r-h2-weight": String(t.h2Weight),
      "--r-h2-tracking": t.h2Tracking,
      "--r-h2-color": t.h2Color,
      "--r-small": `${(t.base - 1.2) * t.scale}pt`,
      "--r-section-gap": `${t.sectionGap * t.density}mm`,
      "--r-role-gap": `${t.roleGap * t.density}mm`,
      "--r-line-gap": `${1.6 * t.density}mm`,
      "--r-rule": t.rule,
    } as any),
    fontFamily: "var(--r-font)",
    fontSize: "var(--r-base)",
    lineHeight: "var(--r-lead)",
    color: "var(--r-text)",
  };
}

/**
 * The same tokens, repointed for the narrow column.
 *
 * Only the colours move. Sizes, gaps and the typeface are the document's, not
 * the column's — a sidebar set in a second font at a second size is two
 * résumés printed on one sheet.
 *
 * And only when the column is *painted*. Six of the fourteen layouts have a
 * narrow column with no fill behind it — it is ordinary paper, just narrower
 * — and repointing those to the sidebar palette set white type on a white
 * page. Everything was there, measured, paginated and positioned correctly,
 * and the column looked empty. Nothing in the markup said so; it only failed
 * by being looked at.
 */
export function asideStyle(t: FlowTheme): React.CSSProperties {
  if (!t.shape.asideFill) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    "--r-text": t.asideText,
    "--r-muted": t.asideText,
    "--r-h2-color": t.asideHeading,
    "--r-accent": t.asideHeading,
    color: t.asideText,
    // A rule the colour of the text is as loud as the text.
    "--r-rule": `0.4pt solid color-mix(in srgb, ${t.asideText} 38%, transparent)`,
  } as any;
}
