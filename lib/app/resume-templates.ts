/**
 * The templates, which are themes and not layouts.
 *
 * This is the load-bearing decision in the whole feature, so it is worth
 * stating plainly: every template here renders the *same* document. Same
 * sections, same order, same markup, same words in the same sequence. What
 * differs is typeface, size, colour, spacing and whether a heading has a rule
 * under it.
 *
 * That is not a shortcut taken to save work. `draftToText` in resume-draft.ts
 * writes the draft out as the plain text a parser would pull from the printed
 * PDF, and that text is what gets scored. It matches ResumeDocument section
 * for section. A template that moved a block, split the page into columns or
 * put the skills in a sidebar would keep the score on screen while changing
 * the file the person actually sends — so the number would quietly stop
 * describing reality. One structure is what keeps that honest.
 *
 * It is also the entire competitive position. Canva has twenty thousand
 * resume templates and its own FAQ tells people to avoid text boxes and
 * tables, which is what its editor is built from. Every template in this file
 * is single-column, real selectable text, no icons, no tables, no photograph,
 * nothing in a header or footer — because the alternative is not offered
 * rather than because we warned somebody against it.
 *
 * Adding one is: a row here, and nothing else. If a new template needs a
 * change to ResumeDocument's markup, that is the signal it is a layout and
 * not a theme, and it needs the score conversation first.
 */

/**
 * Fonts are restricted to the PDF Core-14 families and their metric-compatible
 * substitutes. Anything more interesting risks being swapped at print time,
 * and a swapped font reflows a one-page resume onto two pages — which costs
 * real points and is invisible until somebody opens the file.
 */
const SANS = 'Helvetica, Arial, "Liberation Sans", sans-serif';
const SERIF = '"Times New Roman", Times, "Liberation Serif", serif';

/** The CSS custom properties a template may set. Anything not set inherits. */
export type Theme = {
  /** Body typeface. */
  font?: string;
  /** Base size, in points, because this page is measured for print. */
  size?: string;
  lead?: string;

  /** The name at the top. */
  nameSize?: string;
  nameWeight?: string;
  nameTracking?: string;
  nameColor?: string;

  /** Header block alignment. Centring stays linear, so it stays parseable. */
  align?: string;

  /** Section headings. */
  h2Size?: string;
  h2Weight?: string;
  h2Tracking?: string;
  h2Color?: string;
  /** A full `border-bottom` value, or `none`. */
  h2Rule?: string;
  h2Gap?: string;

  /** Dates, contact line — everything deliberately quieter than the body. */
  muted?: string;

  /** Vertical rhythm. */
  sectionGap?: string;
  roleGap?: string;
};

export type Template = {
  id: string;
  /** What it is called on the card. */
  name: string;
  /** One line, on the card, saying who it is for. Not a description of fonts. */
  blurb: string;
  theme: Theme;
};

/**
 * The default, and the one every existing draft is already rendered in.
 *
 * Named rather than positional so that reordering this list — which is a
 * presentation decision — can never silently change what somebody's saved
 * resume looks like.
 */
export const DEFAULT_TEMPLATE = "classic";

export const TEMPLATES: Template[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "The safe one. Plain headings, a hairline rule, nothing to argue with.",
    theme: {
      font: SANS,
      size: "10pt",
      lead: "1.42",
      nameSize: "19pt",
      nameWeight: "700",
      nameTracking: "-0.01em",
      align: "left",
      h2Size: "9pt",
      h2Weight: "700",
      h2Tracking: "0.08em",
      h2Rule: "0.4pt solid #000",
      h2Gap: "2mm",
      muted: "#333",
      sectionGap: "6mm",
      roleGap: "3.5mm",
    },
  },

  {
    id: "modern",
    name: "Modern",
    blurb: "No rules, more air. Reads well when you have four or five roles.",
    theme: {
      font: SANS,
      size: "10pt",
      lead: "1.5",
      nameSize: "22pt",
      nameWeight: "700",
      nameTracking: "-0.02em",
      align: "left",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.14em",
      h2Rule: "none",
      h2Gap: "2.5mm",
      muted: "#444",
      sectionGap: "7mm",
      roleGap: "4mm",
    },
  },

  {
    id: "editorial",
    name: "Editorial",
    blurb: "Serif, name centred. Suits academia, law, research, writing.",
    theme: {
      font: SERIF,
      size: "10.5pt",
      lead: "1.45",
      nameSize: "21pt",
      nameWeight: "400",
      nameTracking: "0.02em",
      align: "center",
      h2Size: "9pt",
      h2Weight: "700",
      h2Tracking: "0.12em",
      h2Rule: "0.4pt solid #000",
      h2Gap: "2mm",
      muted: "#3a3a3a",
      sectionGap: "6.5mm",
      roleGap: "3.5mm",
    },
  },

  {
    id: "compact",
    name: "Compact",
    blurb: "Tighter everything. For ten years of work that has to stay on one page.",
    theme: {
      font: SANS,
      size: "9.5pt",
      lead: "1.34",
      nameSize: "17pt",
      nameWeight: "700",
      nameTracking: "-0.01em",
      align: "left",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.08em",
      h2Rule: "0.4pt solid #000",
      h2Gap: "1.5mm",
      muted: "#333",
      sectionGap: "4.5mm",
      roleGap: "2.8mm",
    },
  },

  {
    id: "slate",
    name: "Slate",
    blurb: "One colour, used twice. Enough to look designed, not enough to break.",
    theme: {
      font: SANS,
      size: "10pt",
      lead: "1.46",
      nameSize: "20pt",
      nameWeight: "700",
      nameTracking: "-0.015em",
      nameColor: "#1f3a5f",
      align: "left",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.12em",
      h2Color: "#1f3a5f",
      h2Rule: "0.6pt solid #1f3a5f",
      h2Gap: "2mm",
      muted: "#3d3d3d",
      sectionGap: "6.5mm",
      roleGap: "3.8mm",
    },
  },
];

export function templateById(id: string | null | undefined): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function isTemplateId(id: unknown): id is string {
  return typeof id === "string" && TEMPLATES.some((t) => t.id === id);
}

/**
 * The theme as inline custom properties.
 *
 * Returned as a style object rather than injected as a `<style>` block so that
 * several documents can sit on one page in different themes — which is what
 * the gallery is: five live previews of the same resume, side by side.
 */
export function themeVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  const set = (k: string, v: string | undefined) => {
    if (v) vars[`--rd-${k}`] = v;
  };

  set("font", theme.font);
  set("size", theme.size);
  set("lead", theme.lead);
  set("name-size", theme.nameSize);
  set("name-weight", theme.nameWeight);
  set("name-tracking", theme.nameTracking);
  set("name-color", theme.nameColor);
  set("align", theme.align);
  set("h2-size", theme.h2Size);
  set("h2-weight", theme.h2Weight);
  set("h2-tracking", theme.h2Tracking);
  set("h2-color", theme.h2Color);
  set("h2-rule", theme.h2Rule);
  set("h2-gap", theme.h2Gap);
  set("muted", theme.muted);
  set("section-gap", theme.sectionGap);
  set("role-gap", theme.roleGap);

  return vars;
}
