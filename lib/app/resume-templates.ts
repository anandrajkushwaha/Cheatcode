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
 * So a template is now a **layout plus a theme**. Fourteen structures, each
 * dressed several ways, and sixty templates over them. The list is meant to
 * grow and the shape of this file is what decides whether growing it is a row
 * or a rewrite — adding a template is a row; adding a *layout* is a function,
 * and is only worth it when the page genuinely reads differently.
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
 * **A photograph is a property of the template, not of the layout.** Twenty-
 * seven of these reserve a frame and thirty-three do not, and that is copied
 * from the design each came from rather than derived from a rule — two
 * templates share `photo-sidebar` and disagree about it. `showsPhoto()` below is the single
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
 *
 * And six more, for the same reason the first four were added and under the
 * same rule: a layout earns a place by changing what the page *is*, not what
 * colour it is. A recolour is a theme, and a theme is two fields.
 *
 * - `right-sidebar` — the narrow column on the right, so the name and the work
 *   are read first. The mirror of `photo-sidebar`, and a different document.
 * - `boxed` — every section in its own tinted panel.
 * - `top-banner` — a deep colour block holding the name *and* the summary.
 * - `rail-timeline` — the whole résumé hung off one full-width timeline.
 * - `initial-block` — a square photo block top-left, beside the name.
 * - `footer-band` — plain black-on-white name at the top, colour at the foot.
 */
export type Layout =
  | "column"
  | "band"
  | "sidebar"
  | "split"
  | "photo-sidebar"
  | "header-photo"
  | "rule-split"
  | "label-left"
  | "right-sidebar"
  | "boxed"
  | "top-banner"
  | "rail-timeline"
  | "initial-block"
  | "footer-band";

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
    case "right-sidebar":
      // The one layout where the aside is read *second*, and the only reason
      // this function takes a layout rather than a family: a right sidebar
      // scores better than a left one for exactly this reason, and a scorer
      // that lumped them together would be describing the wrong page.
      return {
        aside: ["skills", "education", "certifications"],
        main: ["summary", "experience", "projects", "achievements"],
      };
    case "top-banner":
    case "initial-block":
    case "footer-band":
      return {
        aside: ["skills", "education", "certifications"],
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

/**
 * The audiences, closed.
 *
 * Sixteen, chosen to be the coarsest set that still tells somebody something —
 * an engineer and a designer want different pages, an engineer and a developer
 * do not. These are *categories*, deliberately, and they are what the gallery
 * filter shows: a browse list wants to fit on a screen.
 *
 * Job titles are a separate vocabulary (`ROLE_TITLES` below) sitting on top of
 * these, because the two lists answer different questions. Somebody browsing
 * wants "Design"; somebody who typed "graphic-designer-resume-format" into a
 * search box wants to land on a page that says Graphic Designer. Keeping one
 * list would have meant either a filter panel of forty-five job titles or a
 * set of landing pages nobody searches for.
 */
export type Role =
  | "Any role"
  | "Engineering"
  | "Design"
  | "Data"
  | "Marketing"
  | "Sales"
  | "Finance"
  | "Operations"
  | "Management"
  | "Student"
  | "Healthcare"
  | "Teaching"
  | "Content"
  | "Administration"
  | "Hospitality"
  | "Legal";

export const ROLES: Role[] = [
  "Any role",
  "Engineering",
  "Design",
  "Data",
  "Marketing",
  "Sales",
  "Finance",
  "Operations",
  "Management",
  "Student",
  "Healthcare",
  "Teaching",
  "Content",
  "Administration",
  "Hospitality",
  "Legal",
];

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
  /**
   * Who it suits. A closed list, and it did not start that way.
   *
   * Free-form tags looked like the flexible choice and produced a filter panel
   * with a long tail of ones: "Banking (1)", "Media (1)", "Graphic Design (1)",
   * "Retail (1)". Every one of those is a dead end — a person ticks it, sees a
   * single card, and learns the filter is not worth using. Worse, the tail was
   * arbitrary: "Graphic Design" and "Design" were the same audience typed twice.
   *
   * So the vocabulary is fixed at `Role`, and the invariant is stated where a
   * test can check it: **every role carries at least five templates.** Adding a
   * template is still a row; adding a *category* is a deliberate act that has
   * to be paid for with five designs.
   */
  roles: Role[];

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
    roles: ["Teaching", "Legal", "Data", "Content"],
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
    roles: ["Management", "Operations"],
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
    roles: ["Sales", "Finance", "Management"],
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
    roles: ["Student", "Engineering"],
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
    roles: ["Design", "Marketing"],
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
    roles: ["Student", "Administration", "Teaching"],
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
    roles: ["Design", "Content", "Marketing"],
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
    roles: ["Engineering", "Data", "Design", "Any role"],
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
    roles: ["Engineering", "Data"],
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
    roles: ["Any role", "Management", "Operations"],
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
    roles: ["Design", "Hospitality", "Content"],
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
    roles: ["Sales", "Finance"],
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
    roles: ["Design", "Marketing", "Content"],
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
    roles: ["Student", "Teaching", "Healthcare"],
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
    roles: ["Engineering", "Design", "Operations", "Any role"],
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
    roles: ["Management", "Finance"],
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
    roles: ["Design", "Marketing", "Content"],
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
    roles: ["Student", "Administration"],
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
    roles: ["Any role", "Content", "Data", "Legal"],
    photo: false,
    theme: { accent: "#1c1c1c" },
  },

  {
    id: "ivory-rule",
    name: "Ivory Classic Two Column Resume",
    layout: "rule-split",
    style: "Professional",
    colour: "Brown",
    roles: ["Teaching", "Legal", "Hospitality", "Management"],
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
    roles: ["Design", "Marketing", "Content"],
    photo: false,
    theme: { accent: "#6a4560", wash: "#f0e7ee" },
  },

  {
    id: "slate-rule",
    name: "Slate Grey Professional Divided CV",
    layout: "rule-split",
    style: "Professional",
    colour: "Grey",
    roles: ["Engineering", "Operations", "Management", "Any role"],
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
    roles: ["Any role", "Engineering", "Content", "Data"],
    photo: false,
    theme: { accent: "#1c1c1c" },
  },

  {
    id: "gutter-photo",
    name: "Minimalist Side Label CV with Photo",
    layout: "label-left",
    style: "Minimalist",
    colour: "Grey",
    roles: ["Any role", "Management"],
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
    roles: ["Engineering", "Data", "Design"],
    photo: false,
    theme: { accent: "#2f5bd6" },
  },

  {
    id: "gutter-warm",
    name: "Warm Beige Side Label CV",
    layout: "label-left",
    style: "Simple",
    colour: "Brown",
    roles: ["Hospitality", "Sales", "Administration", "Student"],
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

  /* ================================================= the second thirty ==
   *
   * Six more layouts, five templates each. The count is the point — somebody
   * searching "data-analyst-resume-format" should land on a page with five or
   * six designs on it, not one, and that arithmetic runs backwards into this
   * list: sixteen categories times five is the floor, and a template can only
   * honestly carry three or four categories.
   *
   * Every one of these differs from its neighbours in *both* structure and
   * palette. Five recolours of one layout would have grown the number without
   * growing the choice, which is the failure mode this whole file was
   * rewritten to avoid.
   */

  {
    id: "forest-right",
    name: "Forest Green Right Column Resume",
    layout: "right-sidebar",
    style: "Professional",
    colour: "Green",
    roles: ["Engineering", "Operations", "Management", "Any role"],
    photo: true,
    theme: {
      accent: "#1f4d38",
      onAccent: "#ffffff",
      wash: "#1f4d38",
      asideMm: 64,
      skillMeters: true,
    },
  },
  {
    id: "indigo-right",
    name: "Indigo Right Sidebar CV",
    layout: "right-sidebar",
    style: "Modern",
    colour: "Blue",
    roles: ["Engineering", "Data", "Design", "Management"],
    photo: true,
    theme: {
      accent: "#2b3a72",
      onAccent: "#ffffff",
      wash: "#2b3a72",
      asideMm: 66,
    },
  },
  {
    id: "clay-right",
    name: "Clay Neutral Right Column Resume",
    layout: "right-sidebar",
    style: "Simple",
    colour: "Brown",
    roles: ["Administration", "Hospitality", "Sales", "Student"],
    photo: false,
    theme: {
      accent: "#7d5a3c",
      wash: "#f1eae1",
      asideText: "#5b452f",
      asideHeading: "#7d5a3c",
      asideMm: 64,
    },
  },
  {
    id: "charcoal-right",
    name: "Charcoal Right Sidebar Professional CV",
    layout: "right-sidebar",
    style: "Corporate",
    colour: "Black",
    roles: ["Management", "Finance", "Operations", "Legal"],
    photo: true,
    theme: {
      accent: "#23262b",
      onAccent: "#ffffff",
      wash: "#23262b",
      asideMm: 62,
      skillMeters: true,
    },
  },
  {
    id: "rose-right",
    name: "Rose Right Column Creative Resume",
    layout: "right-sidebar",
    style: "Creative",
    colour: "Pink",
    roles: ["Design", "Content", "Marketing", "Hospitality"],
    photo: false,
    theme: {
      accent: "#a1466a",
      wash: "#f7e9ef",
      asideText: "#5e3245",
      asideHeading: "#a1466a",
      asideMm: 64,
    },
  },
  {
    id: "steel-boxed",
    name: "Grey Boxed Sections Resume",
    layout: "boxed",
    style: "Professional",
    colour: "Grey",
    roles: ["Any role", "Engineering", "Operations", "Administration"],
    photo: false,
    theme: {
      accent: "#3f4650",
      wash: "#f2f3f5",
    },
  },
  {
    id: "mint-boxed",
    name: "Mint Green Boxed Resume",
    layout: "boxed",
    style: "Modern",
    colour: "Green",
    roles: ["Healthcare", "Teaching", "Student", "Administration"],
    photo: false,
    theme: {
      accent: "#2b6a55",
      wash: "#eaf4f0",
    },
  },
  {
    id: "sand-boxed",
    name: "Sand Boxed Classic CV",
    layout: "boxed",
    style: "Simple",
    colour: "Brown",
    roles: ["Hospitality", "Sales", "Content", "Any role"],
    photo: false,
    theme: {
      accent: "#7a6142",
      wash: "#f5f0e7",
    },
  },
  {
    id: "sky-boxed",
    name: "Sky Blue Boxed Resume",
    layout: "boxed",
    style: "Modern",
    colour: "Blue",
    roles: ["Data", "Engineering", "Finance", "Student"],
    photo: false,
    theme: {
      accent: "#2a6291",
      wash: "#eaf2f9",
    },
  },
  {
    id: "lilac-boxed",
    name: "Lilac Boxed Creative CV",
    layout: "boxed",
    style: "Creative",
    colour: "Purple",
    roles: ["Design", "Marketing", "Content", "Legal"],
    photo: false,
    theme: {
      accent: "#5b4a86",
      wash: "#f1eefa",
    },
  },
  {
    id: "midnight-banner",
    name: "Midnight Banner Executive Resume",
    layout: "top-banner",
    style: "Corporate",
    colour: "Black",
    roles: ["Management", "Finance", "Sales", "Legal"],
    photo: true,
    theme: {
      accent: "#1a1f2b",
      onAccent: "#ffffff",
      bandMm: 74,
    },
  },
  {
    id: "teal-banner",
    name: "Teal Banner Modern CV",
    layout: "top-banner",
    style: "Modern",
    colour: "Teal",
    roles: ["Engineering", "Data", "Design", "Any role"],
    photo: true,
    theme: {
      accent: "#146a68",
      onAccent: "#ffffff",
      bandMm: 72,
    },
  },
  {
    id: "crimson-banner",
    name: "Crimson Banner Professional Resume",
    layout: "top-banner",
    style: "Professional",
    colour: "Maroon",
    roles: ["Marketing", "Sales", "Content", "Management"],
    photo: false,
    theme: {
      accent: "#7a1f38",
      onAccent: "#ffffff",
      bandMm: 68,
    },
  },
  {
    id: "forest-banner",
    name: "Forest Banner Graduate CV",
    layout: "top-banner",
    style: "Simple",
    colour: "Green",
    roles: ["Student", "Teaching", "Healthcare", "Administration"],
    photo: true,
    theme: {
      accent: "#245c40",
      onAccent: "#ffffff",
      bandMm: 72,
    },
  },
  {
    id: "violet-banner",
    name: "Violet Banner Creative Resume",
    layout: "top-banner",
    style: "Creative",
    colour: "Purple",
    roles: ["Design", "Content", "Marketing", "Hospitality"],
    photo: false,
    theme: {
      accent: "#4a3573",
      onAccent: "#ffffff",
      bandMm: 70,
    },
  },
  {
    id: "mono-rail",
    name: "Black and White Timeline Resume",
    layout: "rail-timeline",
    style: "Minimalist",
    colour: "Black",
    roles: ["Any role", "Engineering", "Legal", "Content"],
    photo: false,
    theme: {
      accent: "#1c1c1c",
    },
  },
  {
    id: "azure-rail",
    name: "Azure Timeline Developer CV",
    layout: "rail-timeline",
    style: "Modern",
    colour: "Blue",
    roles: ["Engineering", "Data", "Design", "Student"],
    photo: false,
    theme: {
      accent: "#1f5fa8",
    },
  },
  {
    id: "olive-rail",
    name: "Olive Timeline Professional Resume",
    layout: "rail-timeline",
    style: "Professional",
    colour: "Green",
    roles: ["Operations", "Management", "Administration", "Healthcare"],
    photo: false,
    theme: {
      accent: "#556134",
    },
  },
  {
    id: "copper-rail",
    name: "Copper Timeline Creative CV",
    layout: "rail-timeline",
    style: "Creative",
    colour: "Orange",
    roles: ["Design", "Marketing", "Hospitality", "Content"],
    photo: true,
    theme: {
      accent: "#9c5426",
    },
  },
  {
    id: "plum-rail",
    name: "Plum Timeline Career CV",
    layout: "rail-timeline",
    style: "Modern",
    colour: "Purple",
    roles: ["Teaching", "Student", "Healthcare", "Any role"],
    photo: false,
    theme: {
      accent: "#59315c",
    },
  },
  {
    id: "slate-initial",
    name: "Slate Photo Block Minimal Resume",
    layout: "initial-block",
    style: "Minimalist",
    colour: "Grey",
    roles: ["Any role", "Management", "Legal", "Finance"],
    photo: true,
    theme: {
      accent: "#3a4048",
      onAccent: "#ffffff",
    },
  },
  {
    id: "navy-initial",
    name: "Navy Photo Block Professional CV",
    layout: "initial-block",
    style: "Professional",
    colour: "Blue",
    roles: ["Finance", "Sales", "Data", "Management"],
    photo: true,
    theme: {
      accent: "#1d3a63",
      onAccent: "#ffffff",
    },
  },
  {
    id: "emerald-initial",
    name: "Emerald Photo Block Modern Resume",
    layout: "initial-block",
    style: "Modern",
    colour: "Green",
    roles: ["Healthcare", "Teaching", "Operations", "Student"],
    photo: true,
    theme: {
      accent: "#1f6b4f",
      onAccent: "#ffffff",
    },
  },
  {
    id: "burgundy-initial",
    name: "Burgundy Photo Block Classic CV",
    layout: "initial-block",
    style: "Corporate",
    colour: "Maroon",
    roles: ["Legal", "Finance", "Administration", "Management"],
    photo: true,
    theme: {
      accent: "#6b1f33",
      onAccent: "#ffffff",
    },
  },
  {
    id: "amber-initial",
    name: "Amber Photo Block Creative Resume",
    layout: "initial-block",
    style: "Creative",
    colour: "Orange",
    roles: ["Design", "Content", "Marketing", "Hospitality"],
    photo: true,
    theme: {
      accent: "#a35d15",
      onAccent: "#ffffff",
    },
  },
  {
    id: "ink-footer",
    name: "Black Footer Band ATS Resume",
    layout: "footer-band",
    style: "Simple",
    colour: "Black",
    roles: ["Any role", "Engineering", "Data", "Student"],
    photo: false,
    theme: {
      accent: "#141414",
      onAccent: "#ffffff",
      bandMm: 26,
    },
  },
  {
    id: "ocean-footer",
    name: "Ocean Footer Band Resume",
    layout: "footer-band",
    style: "Professional",
    colour: "Blue",
    roles: ["Finance", "Operations", "Sales", "Administration"],
    photo: false,
    theme: {
      accent: "#17527a",
      onAccent: "#ffffff",
      bandMm: 26,
    },
  },
  {
    id: "moss-footer",
    name: "Moss Footer Band Simple CV",
    layout: "footer-band",
    style: "Simple",
    colour: "Green",
    roles: ["Teaching", "Healthcare", "Student", "Administration"],
    photo: false,
    theme: {
      accent: "#3d5c3a",
      onAccent: "#ffffff",
      bandMm: 26,
    },
  },
  {
    id: "rust-footer",
    name: "Rust Footer Band Creative Resume",
    layout: "footer-band",
    style: "Creative",
    colour: "Orange",
    roles: ["Design", "Marketing", "Content", "Hospitality"],
    photo: true,
    theme: {
      accent: "#96431f",
      onAccent: "#ffffff",
      bandMm: 28,
    },
  },
  {
    id: "grape-footer",
    name: "Grape Footer Band Modern CV",
    layout: "footer-band",
    style: "Modern",
    colour: "Purple",
    roles: ["Marketing", "Sales", "Legal", "Any role"],
    photo: false,
    theme: {
      accent: "#4d2a63",
      onAccent: "#ffffff",
      bandMm: 26,
    },
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
  "right-sidebar": true,
  boxed: false,
  "top-banner": true,
  "rail-timeline": false,
  // Its block holds a photograph; a template that opts out gets the monogram.
  "initial-block": true,
  "footer-band": false,
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


/* ----------------------------------------------------------- job titles */

/**
 * The job titles people actually type, each pointing at a category.
 *
 * This exists because of one observation about how the traffic arrives: nobody
 * searches "design resume". They search **"graphic-designer-resume-format"** —
 * a job title, hyphenated, with "resume format" on the end. A gallery filtered
 * by "Design" is the right thing to browse and the wrong thing to land on.
 *
 * ------------------------------------------------------- why not tag directly
 *
 * The obvious shape is a `titles` array on every template, and it is a trap.
 * Forty-five titles across sixty templates is two-hundred-odd hand-written
 * assignments, and the moment one of them is missed a landing page renders
 * with three designs on it — which is worse than not having the page, because
 * a thin page ranks once, disappoints, and does not rank again.
 *
 * Deriving instead makes the count structural: a title shows every template in
 * its category, so "Data Analyst" is as well stocked as "Data" is, and the
 * five-per-role invariant above covers all forty-five pages at once. Nothing
 * to keep in sync, and nothing to forget.
 *
 * Two titles sharing a category show the same designs, and that is correct
 * rather than a shortcut: a data analyst and a business analyst want the same
 * page with a different word at the top of it.
 */
export type RoleTitle = { slug: string; title: string; role: Role };

export const ROLE_TITLES: RoleTitle[] = [
  { slug: "data-analyst", title: "Data Analyst", role: "Data" },
  { slug: "data-scientist", title: "Data Scientist", role: "Data" },
  { slug: "business-analyst", title: "Business Analyst", role: "Data" },
  { slug: "mis-executive", title: "MIS Executive", role: "Data" },
  { slug: "software-engineer", title: "Software Engineer", role: "Engineering" },
  { slug: "full-stack-developer", title: "Full Stack Developer", role: "Engineering" },
  { slug: "civil-engineer", title: "Civil Engineer", role: "Engineering" },
  { slug: "mechanical-engineer", title: "Mechanical Engineer", role: "Engineering" },
  { slug: "qa-engineer", title: "QA Engineer", role: "Engineering" },
  { slug: "graphic-designer", title: "Graphic Designer", role: "Design" },
  { slug: "ui-ux-designer", title: "UI UX Designer", role: "Design" },
  { slug: "product-designer", title: "Product Designer", role: "Design" },
  { slug: "digital-marketing-executive", title: "Digital Marketing Executive", role: "Marketing" },
  { slug: "marketing-manager", title: "Marketing Manager", role: "Marketing" },
  { slug: "seo-executive", title: "SEO Executive", role: "Marketing" },
  { slug: "social-media-manager", title: "Social Media Manager", role: "Marketing" },
  { slug: "sales-executive", title: "Sales Executive", role: "Sales" },
  { slug: "business-development-manager", title: "Business Development Manager", role: "Sales" },
  { slug: "accountant", title: "Accountant", role: "Finance" },
  { slug: "financial-analyst", title: "Financial Analyst", role: "Finance" },
  { slug: "chartered-accountant", title: "Chartered Accountant", role: "Finance" },
  { slug: "operations-manager", title: "Operations Manager", role: "Operations" },
  { slug: "supply-chain-executive", title: "Supply Chain Executive", role: "Operations" },
  { slug: "project-manager", title: "Project Manager", role: "Management" },
  { slug: "product-manager", title: "Product Manager", role: "Management" },
  { slug: "team-lead", title: "Team Lead", role: "Management" },
  { slug: "fresher", title: "Fresher", role: "Student" },
  { slug: "mba", title: "MBA", role: "Student" },
  { slug: "btech-student", title: "B.Tech Student", role: "Student" },
  { slug: "internship", title: "Internship", role: "Student" },
  { slug: "nurse", title: "Nurse", role: "Healthcare" },
  { slug: "medical-representative", title: "Medical Representative", role: "Healthcare" },
  { slug: "teacher", title: "Teacher", role: "Teaching" },
  { slug: "assistant-professor", title: "Assistant Professor", role: "Teaching" },
  { slug: "content-writer", title: "Content Writer", role: "Content" },
  { slug: "technical-writer", title: "Technical Writer", role: "Content" },
  { slug: "hr-executive", title: "HR Executive", role: "Administration" },
  { slug: "hr-manager", title: "HR Manager", role: "Administration" },
  { slug: "office-administrator", title: "Office Administrator", role: "Administration" },
  { slug: "receptionist", title: "Receptionist", role: "Administration" },
  { slug: "hotel-management", title: "Hotel Management", role: "Hospitality" },
  { slug: "chef", title: "Chef", role: "Hospitality" },
  { slug: "lawyer", title: "Lawyer", role: "Legal" },
  { slug: "legal-associate", title: "Legal Associate", role: "Legal" },
  { slug: "experienced-professional", title: "Experienced Professional", role: "Any role" },
];

export function roleTitleBySlug(slug: string): RoleTitle | undefined {
  return ROLE_TITLES.find((t) => t.slug === slug);
}

/** Every template suited to a job title — that is, to the category behind it. */
export function templatesForTitle(slug: string): Template[] {
  const entry = roleTitleBySlug(slug);
  if (!entry) return [];
  return TEMPLATES.filter((t) => t.roles.includes(entry.role));
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
  "right-sidebar": "Right sidebar",
  boxed: "Boxed sections",
  "top-banner": "Top banner",
  "rail-timeline": "Timeline",
  "initial-block": "Photo block",
  "footer-band": "Footer band",
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
