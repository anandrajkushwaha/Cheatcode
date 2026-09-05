/**
 * The templates.
 *
 * This file was, briefly, five themes over one layout — same markup, different
 * type and colour. That was the right answer to a different question: it kept
 * every template's ATS score identical, which mattered while the score was on
 * screen. It is the wrong answer to the question actually being asked, which
 * is a gallery somebody wants to browse. Five variations of one document read
 * as one document with a font picker.
 *
 * So a template is now a **layout plus a theme**. Four structures — a plain
 * column, a coloured header band, a left sidebar, and a two-column body — and
 * each is dressed differently. Ten of them here; the list is meant to grow,
 * and the shape of this file is what decides whether growing it is a row or a
 * rewrite. Adding a template should be a row.
 *
 * Two consequences worth being honest about, because both are real:
 *
 * **The score will differ per template, and that is correct.** A left sidebar
 * genuinely is harder for an applicant tracking system to read than a single
 * column — the contact block gets parsed as an employer, skills come out
 * interleaved with dates. `sectionOrder()` below is what keeps the score
 * honest about it: the scorer walks the sections in the order the chosen
 * layout actually renders them, so a two-column resume is scored as a
 * two-column resume rather than as the single-column one it is not. That
 * number is not on screen yet; the machinery for it is.
 *
 * **Nothing here uses a photograph.** Not squeamishness — there is no photo in
 * the resume schema to use. Where a Canva template would put a headshot, these
 * put a monogram, which needs no upload and cannot be a picture of somebody
 * else. If photographs are wanted the schema is where that starts.
 */

/**
 * Fonts stay inside the PDF Core-14 families and their metric-compatible
 * substitutes. Anything more interesting risks being swapped at print time,
 * and a swapped font reflows a one-page resume onto two pages — which is
 * invisible until somebody opens the file.
 */
const SANS = 'Helvetica, Arial, "Liberation Sans", sans-serif';
const SERIF = '"Times New Roman", Times, "Liberation Serif", serif';

/* --------------------------------------------------------------- layouts */

/**
 * The four structures. These are the thing a parser sees; everything else in
 * a template is paint.
 *
 * - `column` — one column, top to bottom. What a machine reads best.
 * - `band` — a coloured header block, then one column. Same reading order.
 * - `sidebar` — a narrow left column beside a wide right one.
 * - `split` — an equal-ish two-column body under a full-width header.
 */
export type Layout = "column" | "band" | "sidebar" | "split";

/** The blocks a resume is made of, in the order they can be arranged. */
export type SectionKey =
  | "summary"
  | "experience"
  | "projects"
  | "education"
  | "skills"
  | "certifications"
  | "achievements";

const ALL: SectionKey[] = [
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
  "certifications",
  "achievements",
];

/**
 * Which sections go where, for a given layout.
 *
 * One definition, read by both the renderer and the scorer. That shared
 * reading is the point: if the document put skills in a sidebar and the
 * scorer read them as if they were in the main column, the number would
 * describe a file nobody has.
 *
 * `aside` comes first in reading order for a left sidebar, because that is
 * what a left-to-right parser does with one — and it is exactly why a sidebar
 * costs points.
 */
export function sectionOrder(layout: Layout): { aside: SectionKey[]; main: SectionKey[] } {
  switch (layout) {
    case "sidebar":
      return {
        aside: ["skills", "education", "certifications"],
        main: ["summary", "experience", "projects", "achievements"],
      };
    case "split":
      return {
        aside: ["skills", "certifications", "achievements"],
        main: ["summary", "experience", "projects", "education"],
      };
    default:
      return { aside: [], main: ALL };
  }
}

/* ---------------------------------------------------------------- themes */

export type Theme = {
  font?: string;
  size?: string;
  lead?: string;

  nameSize?: string;
  nameWeight?: string;
  nameTracking?: string;
  nameCase?: "none" | "uppercase";

  /** The one colour a template gets to use, and where it lands. */
  accent?: string;
  /** Text on top of the accent, when the accent is a fill. */
  onAccent?: string;
  /** A pale wash of the accent, for a sidebar or a band. */
  wash?: string;
  /**
   * Text inside a sidebar, when the wash it sits on is pale.
   *
   * Sidebars default to white text because most of them are a dark fill. A
   * blush or ivory column needs the opposite, and without this the template
   * renders white on near-white — legible in the design, invisible on screen,
   * and invisible on paper. Set it whenever `wash` is light.
   */
  asideText?: string;
  /** Headings inside a pale sidebar. Defaults to `asideText`. */
  asideHeading?: string;

  align?: string;
  h2Size?: string;
  h2Weight?: string;
  h2Tracking?: string;
  h2Color?: string;
  h2Rule?: string;
  h2Gap?: string;

  muted?: string;
  sectionGap?: string;
  roleGap?: string;

  /** Sidebar width, when there is one. */
  asideWidth?: string;
};

export type Template = {
  id: string;
  /** What it is called under the card. Canva-shaped: colour, style, kind. */
  name: string;
  layout: Layout;
  theme: Theme;

  /* ---- the facets the gallery filters on ---- */

  /** One of a small closed set, so the filter list stays short. */
  style: "Professional" | "Modern" | "Minimalist" | "Creative" | "Corporate" | "Simple";
  /** The colour somebody would say it is, not the hex. */
  colour: "Black" | "Blue" | "Green" | "Teal" | "Purple" | "Maroon" | "Grey" | "Orange";
  /** Who it suits. Free-form on purpose — this is the list that grows fastest. */
  roles: string[];
};

export const DEFAULT_TEMPLATE = "classic-column";

export const TEMPLATES: Template[] = [
  {
    id: "classic-column",
    name: "Black and White Simple Professional",
    layout: "column",
    style: "Simple",
    colour: "Black",
    roles: ["Any role", "Engineering", "Finance", "Management"],
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
      accent: "#000000",
    },
  },

  {
    id: "centred-serif",
    name: "White Minimalist Serif Resume",
    layout: "column",
    style: "Minimalist",
    colour: "Black",
    roles: ["Academic", "Law", "Research", "Writing"],
    theme: {
      font: SERIF,
      size: "10.5pt",
      lead: "1.45",
      nameSize: "23pt",
      nameWeight: "400",
      nameTracking: "0.06em",
      nameCase: "uppercase",
      align: "center",
      h2Size: "9pt",
      h2Weight: "700",
      h2Tracking: "0.16em",
      h2Rule: "0.4pt solid #000",
      h2Gap: "2.5mm",
      muted: "#3a3a3a",
      sectionGap: "6.5mm",
      roleGap: "3.5mm",
      accent: "#000000",
    },
  },

  {
    id: "compact-column",
    name: "Grey Compact Professional Resume",
    layout: "column",
    style: "Professional",
    colour: "Grey",
    roles: ["Senior", "Management", "Operations"],
    theme: {
      font: SANS,
      size: "9.5pt",
      lead: "1.34",
      nameSize: "17pt",
      nameWeight: "700",
      align: "left",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.08em",
      h2Color: "#4a4a4a",
      h2Rule: "0.4pt solid #c9c9c9",
      h2Gap: "1.5mm",
      muted: "#555",
      sectionGap: "4.5mm",
      roleGap: "2.8mm",
      accent: "#4a4a4a",
    },
  },

  {
    id: "navy-band",
    name: "Blue and White Corporate Resume",
    layout: "band",
    style: "Corporate",
    colour: "Blue",
    roles: ["Business", "Sales", "Finance", "Consulting"],
    theme: {
      font: SANS,
      size: "10pt",
      lead: "1.45",
      nameSize: "22pt",
      nameWeight: "700",
      nameTracking: "-0.01em",
      align: "left",
      accent: "#1e3a5f",
      onAccent: "#ffffff",
      wash: "#eef2f7",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.14em",
      h2Color: "#1e3a5f",
      h2Rule: "none",
      h2Gap: "2mm",
      muted: "#444",
      sectionGap: "6mm",
      roleGap: "3.5mm",
    },
  },

  {
    id: "maroon-band",
    name: "Deep Purple Professional Student CV",
    layout: "band",
    style: "Professional",
    colour: "Maroon",
    roles: ["Student", "Fresher", "Computer Science", "Internship"],
    theme: {
      font: SANS,
      size: "10pt",
      lead: "1.44",
      nameSize: "21pt",
      nameWeight: "700",
      nameTracking: "0.02em",
      nameCase: "uppercase",
      align: "left",
      accent: "#5c1f45",
      onAccent: "#ffffff",
      wash: "#f6eef3",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.14em",
      h2Color: "#5c1f45",
      h2Rule: "0.6pt solid #e2cdda",
      h2Gap: "2mm",
      muted: "#4a4a4a",
      sectionGap: "6mm",
      roleGap: "3.5mm",
    },
  },

  {
    id: "slate-sidebar",
    name: "Dark Slate Minimalist CV",
    layout: "sidebar",
    style: "Minimalist",
    colour: "Black",
    roles: ["Design", "Marketing", "Product"],
    theme: {
      font: SANS,
      size: "9.5pt",
      lead: "1.42",
      nameSize: "21pt",
      nameWeight: "700",
      nameTracking: "-0.01em",
      align: "left",
      accent: "#2f3640",
      onAccent: "#ffffff",
      wash: "#2f3640",
      asideWidth: "62mm",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.14em",
      h2Color: "#2f3640",
      h2Rule: "none",
      h2Gap: "2mm",
      muted: "#555",
      sectionGap: "5.5mm",
      roleGap: "3.2mm",
    },
  },

  {
    id: "sage-sidebar",
    name: "Sage Green Simple Student CV",
    layout: "sidebar",
    style: "Simple",
    colour: "Green",
    roles: ["Student", "Fresher", "Administration", "Teaching"],
    theme: {
      font: SANS,
      size: "9.5pt",
      lead: "1.44",
      nameSize: "20pt",
      nameWeight: "700",
      align: "left",
      accent: "#5b7a6b",
      onAccent: "#ffffff",
      wash: "#5b7a6b",
      asideWidth: "58mm",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.12em",
      h2Color: "#3f5a4c",
      h2Rule: "0.6pt solid #cfdad3",
      h2Gap: "2mm",
      muted: "#4f5f56",
      sectionGap: "5.5mm",
      roleGap: "3.2mm",
    },
  },

  {
    id: "blush-sidebar",
    name: "Blush and Grey Creative Resume",
    layout: "sidebar",
    style: "Creative",
    colour: "Orange",
    roles: ["Design", "Graphic Design", "Content", "Social Media"],
    theme: {
      font: SANS,
      size: "9.5pt",
      lead: "1.45",
      nameSize: "22pt",
      nameWeight: "700",
      nameTracking: "-0.02em",
      align: "left",
      accent: "#b06a4f",
      onAccent: "#ffffff",
      wash: "#f3e3dc",
      // A pale sidebar, so the text in it has to go the other way.
      asideText: "#5a4038",
      asideHeading: "#8d4f38",
      asideWidth: "60mm",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.14em",
      h2Color: "#8d4f38",
      h2Rule: "none",
      h2Gap: "2mm",
      muted: "#6a5a54",
      sectionGap: "5.5mm",
      roleGap: "3.2mm",
    },
  },

  {
    id: "teal-split",
    name: "Teal and White Modern Two Column",
    layout: "split",
    style: "Modern",
    colour: "Teal",
    roles: ["Engineering", "Data", "Product", "Any role"],
    theme: {
      font: SANS,
      size: "9.5pt",
      lead: "1.42",
      nameSize: "23pt",
      nameWeight: "700",
      nameTracking: "-0.02em",
      align: "left",
      accent: "#14706b",
      onAccent: "#ffffff",
      wash: "#e7f1f0",
      asideWidth: "56mm",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.14em",
      h2Color: "#14706b",
      h2Rule: "0.6pt solid #b9d8d5",
      h2Gap: "2mm",
      muted: "#4a5a58",
      sectionGap: "5.5mm",
      roleGap: "3.2mm",
    },
  },

  {
    id: "indigo-split",
    name: "Blue and Black Developer Resume",
    layout: "split",
    style: "Modern",
    colour: "Blue",
    roles: ["Engineering", "Developer", "Computer Science", "Data"],
    theme: {
      font: SANS,
      size: "9.5pt",
      lead: "1.4",
      nameSize: "22pt",
      nameWeight: "700",
      nameTracking: "0.01em",
      nameCase: "uppercase",
      align: "left",
      accent: "#2f5bd6",
      onAccent: "#ffffff",
      wash: "#eaefff",
      asideWidth: "54mm",
      h2Size: "8.5pt",
      h2Weight: "700",
      h2Tracking: "0.16em",
      h2Color: "#2f5bd6",
      h2Rule: "none",
      h2Gap: "2mm",
      muted: "#4b5563",
      sectionGap: "5.5mm",
      roleGap: "3.2mm",
    },
  },
];

/* ---------------------------------------------------------------- lookup */

export function templateById(id: string | null | undefined): Template {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function isTemplateId(id: unknown): id is string {
  return typeof id === "string" && TEMPLATES.some((t) => t.id === id);
}

/* --------------------------------------------------------------- filters */

/**
 * The facets, counted, in the shape the filter panel renders.
 *
 * Derived from the templates rather than written out beside them, so a new
 * template with a new role tag appears in the filter list without anybody
 * remembering to add it. Counts included because a filter that leads to an
 * empty grid is worse than no filter.
 */
export type Facet = { value: string; count: number };

function tally(values: string[]): Facet[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** What each layout is called where a person can see it. */
export const LAYOUT_NAMES: Record<Layout, string> = {
  column: "Single column",
  band: "Header band",
  sidebar: "Sidebar",
  split: "Two column",
};

export const FACETS = {
  style: tally(TEMPLATES.map((t) => t.style)),
  colour: tally(TEMPLATES.map((t) => t.colour)),
  layout: tally(TEMPLATES.map((t) => LAYOUT_NAMES[t.layout])),
  role: tally(TEMPLATES.flatMap((t) => t.roles)),
};

export type Filters = {
  search?: string;
  style?: string[];
  colour?: string[];
  layout?: string[];
  role?: string[];
};

/**
 * Narrow the list.
 *
 * Within a facet the choices are OR — picking Blue and Green means either.
 * Across facets they are AND. That is what everybody expects from a filter
 * panel even though nobody could state it, and getting it backwards produces
 * a grid that empties out the moment somebody ticks a second box.
 */
export function filterTemplates(all: Template[], f: Filters): Template[] {
  const q = f.search?.trim().toLowerCase();

  return all.filter((t) => {
    if (f.style?.length && !f.style.includes(t.style)) return false;
    if (f.colour?.length && !f.colour.includes(t.colour)) return false;
    if (f.layout?.length && !f.layout.includes(LAYOUT_NAMES[t.layout])) return false;
    if (f.role?.length && !t.roles.some((r) => f.role!.includes(r))) return false;

    if (q) {
      const haystack = [t.name, t.style, t.colour, LAYOUT_NAMES[t.layout], ...t.roles]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

/* ----------------------------------------------------------------- paint */

/**
 * The theme as inline custom properties.
 *
 * A style object rather than a `<style>` block, so several documents in
 * different themes can sit on one page — which is what the gallery is.
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
  set("name-case", theme.nameCase);
  set("accent", theme.accent);
  set("on-accent", theme.onAccent);
  set("wash", theme.wash);
  set("aside-text", theme.asideText);
  set("aside-heading", theme.asideHeading ?? theme.asideText);
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
  set("aside-width", theme.asideWidth);

  return vars;
}
