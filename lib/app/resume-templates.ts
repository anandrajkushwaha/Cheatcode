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
 * So a template is now a **layout plus a theme**. Eight structures — a plain
 * column, a coloured header band, a left sidebar, a two-column body, and the
 * four added for the reference designs — each dressed differently. Thirty of
 * them here; the list is meant to grow, and the shape of this file is what
 * decides whether growing it is a row or a rewrite. Adding a template should
 * be a row, and the twenty at the bottom are twenty rows.
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
 * **A photograph is a property of the template, not of the layout.** Nine of
 * these reserve a frame and twenty-one do not, and that is copied from the
 * design each came from rather than derived from a rule — two templates share
 * `photo-sidebar` and disagree about it. `showsPhoto()` below is the single
 * answer, and the frame it describes ships *empty*: it says "your photo goes
 * here", it fills when somebody drops a file on it, and it prints as nothing
 * if they never do. The résumé schema still holds no image, so a photograph
 * only ever exists in a design somebody is editing.
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
 * The structures. These are the thing a parser sees; everything else in a
 * template is paint.
 *
 * - `column` — one column, top to bottom. What a machine reads best.
 * - `band` — a coloured header block, then one column. Same reading order.
 * - `sidebar` — a narrow left column beside a wide right one.
 * - `split` — an equal-ish two-column body under a full-width header.
 *
 * And four more, added for the reference designs. Each of these earned its
 * place by being a *different reading order*, not a different palette — the
 * twenty designs they carry differ mostly in colour, and colour is a theme.
 *
 * - `photo-sidebar` — a coloured column with a portrait at the top of it, the
 *   name in the wide column rather than the narrow one. Six of the references.
 * - `header-photo` — a full-bleed band with the portrait inside it, and a
 *   two-column body below, which is what the saved vertical space buys.
 * - `rule-split` — two columns divided by a hairline. No fill anywhere.
 * - `label-left` — section labels in a left gutter, one wide measure of text.
 */
export type Layout =
  | "column"
  | "band"
  | "sidebar"
  | "split"
  | "photo-sidebar"
  | "header-photo"
  | "rule-split"
  | "label-left";

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
    case "photo-sidebar":
      return {
        aside: ["skills", "education", "certifications"],
        main: ["summary", "experience", "projects", "achievements"],
      };
    case "header-photo":
      // The narrow left column carries the summary here, not the skills — the
      // seeder puts "About me" there, and the scorer has to read what is drawn.
      return {
        aside: ["summary", "skills"],
        main: ["education", "experience", "projects", "achievements"],
      };
    case "rule-split":
      return {
        aside: ["education", "skills", "certifications"],
        main: ["summary", "experience", "projects", "achievements"],
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

  /* ------------------------------------------------ geometry, in millimetres
   *
   * Everything above is a CSS string, left from the HTML layout engine this
   * replaced. These are numbers because the seeder lays elements out in
   * millimetres, and mixing "68mm" with 68 in the same object is how a
   * template ends up half a page wide. Named apart for the same reason. */

  /** Sidebar width for the element layouts. */
  asideMm?: number;
  /** Header band height for the element layouts. */
  bandMm?: number;
  /** Draw skills as a row of dots rather than a list. */
  skillMeters?: boolean;
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
  colour:
    | "Black"
    | "Blue"
    | "Green"
    | "Teal"
    | "Purple"
    | "Maroon"
    | "Grey"
    | "Orange"
    | "Brown"
    | "Pink";
  /** Who it suits. Free-form on purpose — this is the list that grows fastest. */
  roles: string[];

  /**
   * Whether this design reserves a place for a portrait.
   *
   * Per template, not per layout. That is the whole point of the field: two
   * templates can share `photo-sidebar` and only one of them draw a frame,
   * because the reference designs they came from differ on exactly that. When
   * it is left out, the layout's own habit applies (`showsPhoto` below).
   *
   * A résumé is not obliged to carry a face, and in India the convention runs
   * both ways depending on the employer — so this is a property of the design
   * somebody chose, and the Frames panel remains the answer for anybody who
   * wants one where the design does not offer it.
   */
  photo?: boolean;
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

  /* ==================================================== the reference set ==
   *
   * Twenty designs, drawn from the reference screenshots. They carry far less
   * per entry than the ten above, and the difference is not carelessness: the
   * CSS-string half of `Theme` — `size`, `h2Rule`, `sectionGap`, `asideWidth`
   * and the rest — is read by nothing any more. The HTML layout engine that
   * consumed it was replaced by the element seeder, which lays out in
   * millimetres and reads exactly six fields: `accent`, `onAccent`, `wash`,
   * `asideText`/`asideHeading`, `asideMm`/`bandMm`, and `skillMeters`.
   *
   * So these entries state the six. Copying forty dead lines into each would
   * have made twenty templates look thorough while describing nothing, and
   * the next person to change a heading size would have changed twenty
   * strings that do not reach the page. The old ten keep theirs because
   * deleting them is a separate change with its own way of going wrong.
   *
   * `photo` is set explicitly on every one of them, true or false, because
   * that is the field the reference decides and the one thing here that is
   * not a colour. Nine have a portrait; eleven do not.
   */

  /* ------------------------------------------- photo sidebar (six designs) */

  {
    id: "charcoal-photo",
    name: "Black and White Modern Professional CV",
    layout: "photo-sidebar",
    style: "Modern",
    colour: "Black",
    roles: ["Any role", "Management", "Consulting", "Operations"],
    photo: true,
    theme: {
      accent: "#26292e",
      onAccent: "#ffffff",
      wash: "#26292e",
      asideMm: 66,
      skillMeters: true,
    },
  },

  {
    id: "olive-photo",
    name: "Olive Green Minimalist Photo Resume",
    layout: "photo-sidebar",
    style: "Minimalist",
    colour: "Green",
    roles: ["Marketing", "Content", "Administration", "Any role"],
    photo: true,
    theme: {
      accent: "#5a6141",
      onAccent: "#ffffff",
      wash: "#6b7150",
      asideMm: 68,
    },
  },

  {
    id: "cream-photo",
    name: "Cream and Brown Elegant CV",
    layout: "photo-sidebar",
    style: "Creative",
    colour: "Brown",
    roles: ["Design", "Hospitality", "Fashion", "Content"],
    photo: true,
    theme: {
      accent: "#7a5c3d",
      wash: "#efe6d9",
      // A pale column, so its text goes dark rather than white.
      asideText: "#4a3b2c",
      asideHeading: "#7a5c3d",
      asideMm: 70,
      skillMeters: true,
    },
  },

  {
    id: "navy-photo",
    name: "Navy Blue Professional Photo Resume",
    layout: "photo-sidebar",
    style: "Professional",
    colour: "Blue",
    roles: ["Business", "Finance", "Sales", "Banking"],
    photo: true,
    theme: {
      accent: "#1f3555",
      onAccent: "#ffffff",
      wash: "#1f3555",
      asideMm: 66,
      skillMeters: true,
    },
  },

  {
    id: "plum-photo",
    name: "Plum and Blush Creative CV",
    layout: "photo-sidebar",
    style: "Creative",
    colour: "Purple",
    roles: ["Design", "Social Media", "Events", "Content"],
    photo: true,
    theme: {
      accent: "#4a2340",
      onAccent: "#ffffff",
      wash: "#4a2340",
      asideMm: 68,
    },
  },

  {
    id: "mist-sidebar",
    name: "Soft Teal Simple Resume",
    layout: "photo-sidebar",
    style: "Simple",
    colour: "Teal",
    roles: ["Student", "Fresher", "Teaching", "Healthcare"],
    // The reference for this one has no portrait — a pale column of contact
    // details and skills, and the name carrying the top of the page instead.
    photo: false,
    theme: {
      accent: "#1f4c49",
      wash: "#dceceb",
      asideText: "#1f4c49",
      asideHeading: "#14706b",
      asideMm: 68,
    },
  },

  /* ------------------------------------------- header photo (four designs) */

  {
    id: "emerald-header",
    name: "Green Modern Photo Header CV",
    layout: "header-photo",
    style: "Modern",
    colour: "Green",
    roles: ["Engineering", "Product", "Operations", "Any role"],
    photo: true,
    theme: {
      accent: "#1f5c46",
      onAccent: "#ffffff",
      bandMm: 54,
    },
  },

  {
    id: "graphite-header",
    name: "Grey Corporate Header Resume",
    layout: "header-photo",
    style: "Corporate",
    colour: "Grey",
    roles: ["Management", "Consulting", "Finance", "Senior"],
    photo: true,
    theme: {
      accent: "#3b3f46",
      onAccent: "#ffffff",
      bandMm: 52,
    },
  },

  {
    id: "rust-header",
    name: "Rust Orange Creative Resume",
    layout: "header-photo",
    style: "Creative",
    colour: "Orange",
    roles: ["Design", "Marketing", "Media", "Content"],
    photo: true,
    theme: {
      accent: "#a8502e",
      onAccent: "#ffffff",
      bandMm: 56,
    },
  },

  {
    id: "sky-header",
    name: "Light Blue Simple Header CV",
    layout: "header-photo",
    style: "Simple",
    colour: "Blue",
    roles: ["Student", "Fresher", "Internship", "Administration"],
    // A name band rather than a portrait band: the reference fills the strip
    // with the name alone, which is why the band is shallower here.
    photo: false,
    theme: {
      accent: "#2b6ea8",
      onAccent: "#ffffff",
      bandMm: 40,
    },
  },

  /* --------------------------------------------- rule split (five designs) */

  {
    id: "hairline-mono",
    name: "Black and White Minimalist Divided CV",
    layout: "rule-split",
    style: "Minimalist",
    colour: "Black",
    roles: ["Any role", "Writing", "Research", "Law"],
    photo: false,
    theme: { accent: "#1c1c1c" },
  },

  {
    id: "ivory-rule",
    name: "Ivory Classic Two Column Resume",
    layout: "rule-split",
    style: "Professional",
    colour: "Brown",
    roles: ["Academic", "Law", "Hospitality", "Management"],
    photo: false,
    theme: { accent: "#6b5a42", wash: "#f2ece1" },
  },

  {
    id: "sage-rule",
    name: "Sage Divided Simple CV",
    layout: "rule-split",
    style: "Simple",
    colour: "Green",
    roles: ["Teaching", "Healthcare", "Administration", "Student"],
    photo: false,
    theme: { accent: "#4e6b58", wash: "#e6ede7" },
  },

  {
    id: "mauve-rule",
    name: "Mauve Elegant Divided Resume",
    layout: "rule-split",
    style: "Creative",
    colour: "Pink",
    roles: ["Design", "Events", "Fashion", "Content"],
    photo: false,
    theme: { accent: "#6a4560", wash: "#f0e7ee" },
  },

  {
    id: "slate-rule",
    name: "Slate Grey Professional Divided CV",
    layout: "rule-split",
    style: "Professional",
    colour: "Grey",
    roles: ["Engineering", "Operations", "Senior", "Any role"],
    photo: false,
    theme: { accent: "#3a444f" },
  },

  /* --------------------------------------------- label left (five designs) */

  {
    id: "gutter-mono",
    name: "Black and White Side Label Resume",
    layout: "label-left",
    style: "Minimalist",
    colour: "Black",
    roles: ["Any role", "Engineering", "Writing", "Research"],
    photo: false,
    theme: { accent: "#1c1c1c" },
  },

  {
    id: "gutter-photo",
    name: "Minimalist Side Label CV with Photo",
    layout: "label-left",
    style: "Minimalist",
    colour: "Grey",
    roles: ["Any role", "Management", "Consulting"],
    // The one design in this family that reserves a frame, and the reason
    // `photo` had to stop being a property of the layout.
    photo: true,
    theme: { accent: "#4a4a4a" },
  },

  {
    id: "gutter-blue",
    name: "Blue Accent Side Label Resume",
    layout: "label-left",
    style: "Modern",
    colour: "Blue",
    roles: ["Developer", "Data", "Product", "Engineering"],
    photo: false,
    theme: { accent: "#2f5bd6" },
  },

  {
    id: "gutter-warm",
    name: "Warm Beige Side Label CV",
    layout: "label-left",
    style: "Simple",
    colour: "Brown",
    roles: ["Hospitality", "Retail", "Administration", "Student"],
    photo: false,
    theme: { accent: "#8a6a45" },
  },

  {
    id: "gutter-green",
    name: "Green Side Label Professional Resume",
    layout: "label-left",
    style: "Professional",
    colour: "Green",
    roles: ["Healthcare", "Teaching", "Operations", "Any role"],
    photo: false,
    theme: { accent: "#2f6b4f" },
  },
];

/* ---------------------------------------------------------------- lookup */

/**
 * Whether this template has somewhere to put a photograph.
 *
 * Two questions, answered in order. The template's own `photo` wins, because
 * the design is the authority — it was drawn with a frame or without one, and
 * no rule about layouts should overrule the drawing.
 *
 * Failing that, the layout's habit. A plain column and the two-column split
 * have nowhere: there is no composition hole, and dropping a circle into a
 * text column looks like a mistake. `label-left` likewise runs one wide
 * measure. The rest reserve a block of colour a picture can live in.
 *
 * The toolbar reads this so the upload button can say so, rather than
 * accepting a photo that then appears nowhere — the kind of silence people
 * spend ten minutes debugging as their own error.
 */
const LAYOUT_TAKES_PHOTO: Record<Layout, boolean> = {
  column: false,
  band: true,
  sidebar: true,
  split: false,
  "photo-sidebar": true,
  "header-photo": true,
  "rule-split": false,
  "label-left": false,
};

export function showsPhoto(t: Template): boolean {
  return t.photo ?? LAYOUT_TAKES_PHOTO[t.layout];
}

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
  "photo-sidebar": "Photo sidebar",
  "header-photo": "Photo header",
  "rule-split": "Divided column",
  "label-left": "Side labels",
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
