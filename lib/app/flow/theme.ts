import { templateById, type Template } from "@/lib/app/resume-templates";

/**
 * A template's look, as numbers the renderer can do arithmetic on.
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
  font: string;
  accent: string;
  /** Body size, in points. */
  base: number;
  /** The name at the top, in points. */
  nameSize: number;
  /** Multiplies every gap. 1 is the template's own spacing. */
  density: number;
  /** Multiplies every type size. 1 is the template's own scale. */
  scale: number;
  /** Space between sections, in millimetres, before density is applied. */
  sectionGap: number;
  rule: string;
  /** Width of the narrow column, in millimetres. Zero for one-column. */
  asideMm: number;
};

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

export function flowTheme(templateId: string | null | undefined, o: Overrides = {}): FlowTheme {
  const t: Template = templateById(templateId);
  const th = t.theme as Record<string, string | number | undefined>;

  return {
    font: o.font ?? String(th.font ?? "ui-sans-serif, system-ui, sans-serif"),
    accent: o.accent ?? String(th.accent ?? "#000000"),
    base: num(th.size, 10),
    nameSize: num(th.nameSize, 19),
    density: o.density ?? 1,
    scale: o.scale ?? 1,
    sectionGap: num(th.sectionGap, 6),
    rule: String(th.h2Rule ?? "0.4pt solid currentColor"),
    asideMm: num(th.asideMm, 0),
  };
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
      "--r-base": `${t.base * t.scale}pt`,
      "--r-name": `${t.nameSize * t.scale}pt`,
      "--r-h2": `${(t.base + 1.5) * t.scale}pt`,
      "--r-small": `${(t.base - 1) * t.scale}pt`,
      "--r-section-gap": `${t.sectionGap * t.density}mm`,
      "--r-line-gap": `${1.6 * t.density}mm`,
      "--r-rule": t.rule,
    } as any),
    fontFamily: "var(--r-font)",
    fontSize: "var(--r-base)",
    color: "#111",
  };
}
