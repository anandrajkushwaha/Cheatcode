import {
  A4,
  blankPage,
  icon,
  image,
  line,
  PT,
  shape,
  text,
  type Design,
  type Element,
  type Page,
  type TextElement,
} from "@/lib/app/design";
import type { Resume } from "@/lib/app/resume-schema";
import {
  showsPhoto,
  templateById,
  type Layout,
  type Template,
} from "@/lib/app/resume-templates";
import type { IconName } from "@/lib/app/design-icons";

/**
 * A template, poured full of somebody's résumé, once.
 *
 * This runs exactly once per design — when it is created. After that the
 * elements are the document and nothing re-derives them, which is the whole
 * difference between this and the layout engine it replaces. Somebody who
 * drags a heading two millimetres left has made a decision, and a seeder that
 * ran again on the next save would quietly undo it.
 *
 * That also means this file is allowed to be opinionated and is not allowed to
 * be clever. It lays out a first draft that looks like the template's picture.
 * Everything after that is the person's problem, in the good sense.
 *
 * ------------------------------------------------------------ the estimate
 *
 * Elements carry an explicit height, and text height depends on where lines
 * wrap, which depends on font metrics this file does not have. So heights here
 * are estimated from an average glyph width, and the editor re-measures every
 * auto-height text box against the real fonts on first paint and writes the
 * true numbers back.
 *
 * The estimate being approximate is fine; it being *absent* would not be. A
 * box with no height would collapse and the whole first draft would land on
 * top of itself before the measuring pass could run.
 */

/**
 * Average glyph width as a fraction of the type size.
 *
 * Bold and capitals are wider, and getting that wrong is not symmetric: an
 * over-estimate leaves a gap somebody can close, an under-estimate drops the
 * next block on top of this one. A name in a narrow sidebar is exactly where
 * it bites — "Anand Raj Kushwaha" is eighteen characters, fits on one line at
 * 0.50em and takes two at 0.56em, and the headline lands on top of it either
 * way if the guess is the optimistic one. So the numbers lean wide, and the
 * final height carries a few percent of slack on top.
 */
const GLYPH = 0.52;
const SLACK = 1.05;

function estimateLines(body: string, widthMm: number, sizePt: number, style: { bold?: boolean; caps?: boolean }): number {
  const glyph = GLYPH * (style.bold ? 1.07 : 1) * (style.caps ? 1.12 : 1);
  const perLine = Math.max(1, Math.floor(widthMm / (glyph * sizePt * PT)));
  return body
    .split("\n")
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.length / perLine)), 0);
}

function estimateHeight(
  body: string,
  widthMm: number,
  sizePt: number,
  lh: number,
  style: { bold?: boolean; caps?: boolean } = {},
): number {
  return estimateLines(body, widthMm, sizePt, style) * sizePt * PT * lh * SLACK;
}

/* ------------------------------------------------------------ the cursor */

/**
 * A column you push blocks into.
 *
 * Everything below is written as "put this here, then move down", because that
 * is how the layouts actually read and because it keeps the arithmetic in one
 * place. `gap` is applied before a block rather than after, so a column never
 * ends with trailing space that would push the next thing off the page.
 */
class Column {
  readonly out: Element[] = [];

  constructor(
    private readonly x: number,
    private y: number,
    readonly w: number,
  ) {}

  get bottom() {
    return this.y;
  }

  /** The column's left edge, for anything placed beside a block rather than in it. */
  get xPos() {
    return this.x;
  }

  space(mm: number) {
    this.y += mm;
  }

  push(el: Element) {
    this.out.push(el);
    return el;
  }

  /**
   * A block of text, sized to what it will probably take.
   *
   * `indent` shifts the block right and narrows it by the same amount, so text
   * beside a glyph or a timeline rail stays inside the column rather than
   * hanging off its right edge — which is what a plain x-offset would do.
   */
  text(
    body: string,
    opts: Partial<TextElement> & { gap?: number; indent?: number } = {},
  ): TextElement | null {
    if (!body.trim()) return null;
    const { gap = 0, indent = 0, ...rest } = opts;
    this.y += gap;
    const size = rest.size ?? 10;
    const lh = rest.lineHeight ?? 1.35;
    const width = this.w - indent;
    // A list draws a marker in the same column as the words, so its lines are
    // shorter and it wraps sooner. Roughly a marker plus its gap.
    const usable = rest.list && rest.list !== "none" ? width - size * PT * 1.2 : width;
    const h = estimateHeight(body, usable, size, lh, { bold: rest.bold, caps: rest.caps });
    const el = text({ ...rest, text: body, x: this.x + indent, y: this.y, w: width, h });
    this.y += h;
    this.out.push(el);
    return el;
  }

  /** A horizontal rule across the column. */
  rule(colour: string, opts: { gap?: number; weight?: number } = {}) {
    this.y += opts.gap ?? 0;
    this.out.push(
      line({ x: this.x, y: this.y, w: this.w, h: opts.weight ?? 0.3, stroke: colour, strokeWidth: opts.weight ?? 0.3 }),
    );
    this.y += opts.weight ?? 0.3;
  }
}

/* -------------------------------------------------------------- the words */

const nonEmpty = (parts: (string | null | undefined)[]) =>
  parts.map((p) => (p ?? "").trim()).filter(Boolean);

function contactLine(c: Resume): string {
  return nonEmpty([c.email, c.phone, c.location]).join("  ·  ");
}

function contactStack(c: Resume): string {
  return nonEmpty([c.email, c.phone, c.location, ...c.links.map((l) => l.url)]).join("\n");
}

function roleBlocks(c: Resume): { head: string; dates: string; bullets: string }[] {
  return c.roles.map((r) => ({
    head: nonEmpty([r.title, r.company]).join("  —  "),
    dates: nonEmpty([r.start, r.end]).join("  –  "),
    bullets: (r.highlights ?? []).map((h) => h.trim()).filter(Boolean).join("\n"),
  }));
}

function projectBlocks(c: Resume): { head: string; dates: string; bullets: string }[] {
  return c.projects.map((p) => ({
    head: nonEmpty([p.name, p.link]).join("  —  "),
    dates: (p.description ?? "").trim(),
    bullets: (p.highlights ?? []).map((h) => h.trim()).filter(Boolean).join("\n"),
  }));
}

function educationBlocks(c: Resume): { head: string; dates: string }[] {
  return c.education.map((e) => ({
    head: nonEmpty([e.degree, e.institution]).join("  —  "),
    dates: (e.year ?? "").trim(),
  }));
}

/* ---------------------------------------------------------- new furniture */

/**
 * A heading with a glyph beside it.
 *
 * The icon is placed rather than pushed into the column, because the column
 * only knows about full-width blocks and this sits in the margin next to one.
 * The heading text is indented by the glyph's width plus a gap so the two read
 * as one line rather than as a mark that happens to be near some words.
 */
function iconHeading(
  col: Column,
  label: string,
  name: IconName,
  ink: Ink,
  opts: { gap?: number; size?: number } = {},
) {
  const glyph = opts.size ?? 4.6;
  col.space(opts.gap ?? 6);
  const y = col.bottom;
  col.push(icon({ name, x: col.xPos, y: y + 0.3, w: glyph, h: glyph, colour: ink.heading, weight: 0.42 }));
  col.text(label, {
    size: 10.5,
    bold: true,
    color: ink.heading,
    lineHeight: 1.2,
    indent: glyph + 2.4,
  });
}

/**
 * Entries hung off a vertical rail, the way the reference designs draw them.
 *
 * The rail is drawn *after* the entries because its height is only known once
 * they have been laid out — which is also why this cannot be a `Column`
 * method: the column does not know where a group of blocks starts and stops.
 */
function timelineEntries(
  col: Column,
  list: { head: string; dates: string; bullets: string }[],
  ink: Ink,
  accent: string,
) {
  const railX = col.xPos + 1.6;
  const top = col.bottom + 3;
  const dots: number[] = [];

  for (const item of list) {
    col.space(3.4);
    dots.push(col.bottom + 1.4);
    col.text(item.dates, { size: 8.5, bold: true, color: ink.muted, lineHeight: 1.2, indent: 7 });
    col.text(item.head, { gap: 0.8, size: 10, bold: true, color: ink.body, lineHeight: 1.25, indent: 7 });
    col.text(item.bullets, { gap: 1.2, size: 9.2, color: ink.body, list: "bullet", lineHeight: 1.4, indent: 7 });
  }

  if (!dots.length) return;
  const bottom = col.bottom;
  // A thin rect rather than a `line`: lines are drawn as a CSS top border, so
  // they are horizontal by construction and a 0.35mm-wide one would be invisible.
  col.push(shape({ x: railX, y: top, w: 0.35, h: bottom - top, fill: accent }));
  for (const y of dots) {
    col.push(shape({ x: railX - 1.2, y: y - 1.2, w: 2.4, h: 2.4, shape: "ellipse", fill: accent }));
  }
}

/**
 * A skill and a row of five dots, however many of them are filled.
 *
 * The reference designs all draw a rating and none of them say what it means,
 * which is the honest reading: it is a visual weight, not a measurement. So
 * this fills four of five for everything rather than inventing a score the
 * résumé does not contain — somebody who wants to say "three" can click a dot
 * and change its colour.
 */
function skillMeters(col: Column, skills: string[], ink: Ink, accent: string) {
  for (const name of skills.slice(0, 8)) {
    col.text(name, { gap: 2.6, size: 9, color: ink.body, lineHeight: 1.2 });
    const y = col.bottom + 1.4;
    for (let i = 0; i < 5; i++) {
      col.push(
        shape({
          x: col.xPos + i * 3.4,
          y,
          w: 2.2,
          h: 2.2,
          shape: "ellipse",
          fill: i < 4 ? accent : "transparent",
          stroke: accent,
          strokeWidth: 0.25,
        }),
      );
    }
    col.space(3.6);
  }
}

/** Contact lines with a glyph in front of each, as most of the references do. */
function iconContact(col: Column, c: Resume, ink: Ink) {
  const rows = (
    [
      { name: "phone", value: c.phone ?? "" },
      { name: "mail", value: c.email ?? "" },
      { name: "pin", value: c.location ?? "" },
      { name: "globe", value: c.links[0]?.url ?? "" },
    ] satisfies { name: IconName; value: string }[]
  ).filter((r) => r.value.trim());

  for (const row of rows) {
    col.space(2.6);
    const y = col.bottom;
    col.push(icon({ name: row.name, x: col.xPos, y: y - 0.2, w: 3.6, h: 3.6, colour: ink.muted, weight: 0.34 }));
    col.text(row.value, { size: 8.6, color: ink.body, lineHeight: 1.25, indent: 5.6 });
  }
}

/* ------------------------------------------------------------- the pieces */

type Ink = {
  heading: string;
  body: string;
  muted: string;
  rule: string;
};

/** A section heading, with the rule underneath that most of these have. */
function heading(col: Column, label: string, ink: Ink, opts: { rule?: boolean; gap?: number } = {}) {
  col.text(label, {
    gap: opts.gap ?? 6,
    size: 8.5,
    bold: true,
    caps: true,
    letterSpacing: 0.09,
    color: ink.heading,
    lineHeight: 1.2,
  });
  if (opts.rule !== false) col.rule(ink.rule, { gap: 1.4 });
}

/** Experience and Projects are the same block with different words in it. */
function entries(
  col: Column,
  list: { head: string; dates: string; bullets: string }[],
  ink: Ink,
) {
  for (const item of list) {
    col.text(item.head, { gap: 3.4, size: 10, bold: true, color: ink.body, lineHeight: 1.25 });
    col.text(item.dates, { gap: 0.6, size: 8.5, color: ink.muted, lineHeight: 1.25 });
    col.text(item.bullets, {
      gap: 1.4,
      size: 9.5,
      color: ink.body,
      list: "bullet",
      lineHeight: 1.4,
    });
  }
}

function sectionInto(
  col: Column,
  key: string,
  c: Resume,
  ink: Ink,
  opts: { rule?: boolean; stackContact?: boolean } = {},
) {
  const rule = opts.rule;
  switch (key) {
    case "summary":
      if (!c.summary?.trim()) return;
      heading(col, "Summary", ink, { rule });
      col.text(c.summary, { gap: 2.4, size: 9.5, color: ink.body, lineHeight: 1.45 });
      return;

    case "experience": {
      const list = roleBlocks(c);
      if (!list.length) return;
      heading(col, "Experience", ink, { rule });
      entries(col, list, ink);
      return;
    }

    case "projects": {
      const list = projectBlocks(c);
      if (!list.length) return;
      heading(col, "Projects", ink, { rule });
      entries(col, list, ink);
      return;
    }

    case "education": {
      const list = educationBlocks(c);
      if (!list.length) return;
      heading(col, "Education", ink, { rule });
      for (const e of list) {
        col.text(e.head, { gap: 2.8, size: 9.5, bold: true, color: ink.body, lineHeight: 1.3 });
        col.text(e.dates, { gap: 0.6, size: 8.5, color: ink.muted, lineHeight: 1.25 });
      }
      return;
    }

    case "skills":
      if (!c.skills.length) return;
      heading(col, "Skills", ink, { rule });
      col.text(
        // Down the page in a narrow column, across it in a wide one. A
        // comma-separated run in a 45mm sidebar wraps into a grey block
        // nobody reads.
        col.w < 60 ? c.skills.join("\n") : c.skills.join(", "),
        { gap: 2.4, size: 9.5, color: ink.body, lineHeight: 1.5 },
      );
      return;

    case "certifications":
      if (!c.certifications.length) return;
      heading(col, "Certifications", ink, { rule });
      col.text(c.certifications.join("\n"), { gap: 2.4, size: 9.5, color: ink.body, lineHeight: 1.5 });
      return;

    case "achievements":
      if (!c.achievements.length) return;
      heading(col, "Achievements", ink, { rule });
      col.text(c.achievements.join("\n"), {
        gap: 2.4,
        size: 9.5,
        color: ink.body,
        list: "bullet",
        lineHeight: 1.4,
      });
      return;

    case "contact":
      if (!opts.stackContact) return;
      heading(col, "Contact", ink, { rule });
      col.text(contactStack(c), { gap: 2.4, size: 9, color: ink.body, lineHeight: 1.6 });
      return;
  }
}

/* ------------------------------------------------------------ the layouts */

const M = 14; // page margin, millimetres

/**
 * An empty photo frame, for the layouts that have somewhere to put one.
 *
 * Not every template. `showsPhoto()` in resume-templates.ts is the rule, and
 * it now answers **per template rather than per layout** — two designs can
 * share `photo-sidebar` and only one of them draw a frame, because that is
 * what the references they came from do. Where a template says nothing, the
 * layout's habit applies: the ones that reserve a block of colour a picture
 * can live in take one, the rest do not.
 *
 * The plain column, the two-column split and the side-label design are
 * without one by default. In each, the only way to fit a photo is to take the
 * space from the words: a frame top-right narrows the name, and one at the top
 * of the split's aside costs four centimetres of the tightest column on the
 * page. A template should not spend somebody's layout on a picture they may
 * not want — and if they do want it, the Frames panel puts one anywhere in two
 * clicks.
 *
 * Every layout below therefore asks before it draws, and reclaims the space
 * when the answer is no. A layout that reserved the gap either way would be
 * the worst of both: no picture, and no room for the words that replace it.
 *
 * Empty is the point. It says "your photo goes here", it fills by dropping a
 * file on it, and if it is never filled it prints as nothing at all.
 */
function photoFrame(x: number, y: number, size: number, shapeKind: "circle" | "rect" = "circle") {
  return image({ x, y, w: size, h: size, shape: shapeKind, radius: shapeKind === "rect" ? 3 : 0 });
}

/**
 * Break a column above a hard limit, and carry the rest to the next sheet.
 *
 * `seedDesign` splits on the page edge and cannot do better, because it sees a
 * flat list of boxes and has no idea which of them belong to the same column
 * (see the note there). A layout does know, so a layout that has furniture at
 * the foot of the page can do the thing the general case cannot: find the
 * first block that would collide, and move it *and everything after it in this
 * column* down by one sheet, landing at the top margin rather than at whatever
 * negative offset the arithmetic would otherwise produce.
 *
 * That is a real page break — the run keeps its internal spacing and its
 * order, and the gap it leaves above the band reads as a page ending rather
 * than as text disappearing under a colour block.
 */
function breakAbove(els: Element[], limit: number, topMargin = M): Element[] {
  const at = els.findIndex((el) => el.y + el.h > limit);
  if (at < 0) return els;
  const delta = A4.h + topMargin - els[at].y;
  return els.map((el, i) => (i < at ? el : { ...el, y: el.y + delta }));
}

function columnLayout(c: Resume, t: Template, centred: boolean): Element[] {
  const ink: Ink = {
    heading: t.theme.accent ?? "#000",
    body: "#111111",
    muted: "#6b6b6b",
    rule: "#d9d9d9",
  };
  /**
   * No photo frame here, deliberately.
   *
   * This is the plain single-column résumé — one measure of text from margin
   * to margin, and the layout every ATS reads best. There is nowhere for a
   * picture to go that is not *taken from* the words: putting one top-right
   * narrowed the name and headline column to make room, and putting one above
   * a centred name pushed the whole document down a centimetre. Both were a
   * real cost paid for something this template is not for.
   *
   * Somebody who wants a photo on this layout can still add one from the
   * Frames panel — the difference is that it is then their decision, made
   * with the space in front of them, rather than ours made in advance.
   *
   * A template may still ask for one by setting `photo: true`, and then it
   * gets one, top-right, with the header narrowed to pay for it. None
   * currently does. The branch exists so `showsPhoto()` cannot promise the
   * toolbar something the page does not draw — a switch that reports "yes"
   * and produces nothing is the failure this whole field was added to end.
   */
  const photo = showsPhoto(t) ? 26 : 0;
  const col = new Column(M, M, A4.w - M * 2 - (photo ? photo + 8 : 0));

  const align = centred ? "center" : "left";
  const serif = centred ? "EB Garamond" : "Inter";

  col.text(c.full_name ?? "Your name", {
    size: centred ? 22 : 20,
    bold: !centred,
    caps: centred,
    letterSpacing: centred ? 0.06 : -0.01,
    font: serif,
    align,
    color: ink.heading,
    lineHeight: 1.15,
  });
  col.text(c.headline ?? "", { gap: 1.6, size: 11, font: serif, align, color: ink.muted });
  col.text(contactLine(c), { gap: 2, size: 8.8, font: serif, align, color: ink.muted });
  col.rule(ink.rule, { gap: 3.5 });

  for (const key of ["summary", "experience", "projects", "education", "skills", "certifications", "achievements"]) {
    sectionInto(col, key, c, { ...ink, heading: ink.heading }, {});
  }

  if (serif !== "Inter") for (const el of col.out) if (el.type === "text") el.font = serif;
  return photo ? [photoFrame(A4.w - M - photo, M, photo), ...col.out] : col.out;
}

function bandLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#1e3a5f";
  const onAccent = t.theme.onAccent ?? "#ffffff";
  const ink: Ink = { heading: accent, body: "#111111", muted: "#6b6b6b", rule: "#dcdcdc" };
  const bandH = 42;

  const out: Element[] = [
    // Full bleed, deliberately: the band is the template. It runs to the
    // paper's edge on all three sides, which is why the page margin does not
    // apply to it and why it is the first element in the stack.
    shape({ x: 0, y: 0, w: A4.w, h: bandH, fill: accent }),
  ];

  const photo = showsPhoto(t);
  if (photo) out.push(photoFrame(A4.w - M - 26, (bandH - 26) / 2, 26));

  // The header text gets the frame's width back when there is no frame.
  const head = new Column(M, 12, A4.w - M * 2 - (photo ? 34 : 0));
  head.text(c.full_name ?? "Your name", {
    size: 19,
    bold: true,
    caps: true,
    letterSpacing: 0.02,
    color: onAccent,
    lineHeight: 1.1,
  });
  head.text(c.headline ?? "", { gap: 1.6, size: 10.5, color: onAccent, opacity: 0.88 });
  head.text(contactLine(c), { gap: 2, size: 8.5, color: onAccent, opacity: 0.8 });
  out.push(...head.out);

  const col = new Column(M, bandH + 12, A4.w - M * 2);
  for (const key of ["summary", "experience", "projects", "education", "skills", "certifications", "achievements"]) {
    sectionInto(col, key, c, ink, {});
  }
  out.push(...col.out);
  return out;
}

function sidebarLayout(c: Resume, t: Template): Element[] {
  const wash = t.theme.wash ?? "#2f3640";
  const asideText = t.theme.asideText ?? t.theme.onAccent ?? "#ffffff";
  const asideHeading = t.theme.asideHeading ?? asideText;
  const asideW = 66;

  const out: Element[] = [shape({ x: 0, y: 0, w: asideW, h: A4.h, fill: wash })];

  const aside = new Column(9, 14, asideW - 18);
  // A photo, where the monogram used to be. The initials were a stand-in for
  // a face; this is the face, and it falls back to nothing rather than to two
  // letters when there is no picture.
  if (showsPhoto(t)) {
    out.push(photoFrame(asideW / 2 - 13, 13, 26));
    aside.space(30);
  }

  aside.text(c.full_name ?? "Your name", { size: 14, bold: true, color: asideText, lineHeight: 1.2 });
  aside.text(c.headline ?? "", { gap: 1.4, size: 9, color: asideText, opacity: 0.85, lineHeight: 1.3 });

  const asideInk: Ink = { heading: asideHeading, body: asideText, muted: asideText, rule: asideText };
  for (const key of ["contact", "skills", "education", "certifications"]) {
    sectionInto(aside, key, c, asideInk, { stackContact: true });
  }
  // A rule the colour of the text would be as loud as the text. Quieten every
  // rule in the sidebar rather than adding a second colour token per template.
  for (const el of aside.out) if (el.type === "line") el.opacity = 0.35;
  out.push(...aside.out);

  const ink: Ink = { heading: t.theme.accent ?? "#111", body: "#111111", muted: "#6b6b6b", rule: "#dcdcdc" };
  const main = new Column(asideW + 12, 16, A4.w - asideW - 12 - M);
  for (const key of ["summary", "experience", "projects", "achievements"]) {
    sectionInto(main, key, c, ink, {});
  }
  out.push(...main.out);
  return out;
}

function splitLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#14706b";
  const wash = t.theme.wash ?? "#e7f1f0";
  const ink: Ink = { heading: accent, body: "#111111", muted: "#6b6b6b", rule: "#dcdcdc" };
  const headH = 34;
  const asideW = 62;

  const out: Element[] = [];

  const head = new Column(M, 14, A4.w - M * 2);
  head.text(c.full_name ?? "Your name", {
    size: 20,
    bold: true,
    color: accent,
    lineHeight: 1.15,
  });
  head.text(c.headline ?? "", { gap: 1.4, size: 10.5, color: "#4a4a4a" });
  head.text(contactLine(c), { gap: 1.6, size: 8.5, color: "#6b6b6b" });
  out.push(...head.out);
  out.push(line({ x: M, y: headH + 4, w: A4.w - M * 2, h: 0.5, stroke: accent, strokeWidth: 0.5 }));

  const top = headH + 12;
  out.push(shape({ x: M, y: top, w: asideW, h: A4.h - top - M, fill: wash }));

  // No frame here by default: the aside is a narrow column of skills and dates
  // that runs the height of the page, and a photo at the top of it costs four
  // centimetres of the one column that was already the tightest. A template
  // that asks for one anyway gets it, for the reason given in `columnLayout`.
  const photo = showsPhoto(t) ? Math.min(34, asideW - 16) : 0;
  if (photo) out.push(photoFrame(M + asideW / 2 - photo / 2, top + 8, photo));
  const aside = new Column(M + 7, top + 8 + (photo ? photo + 7 : 0), asideW - 14);
  const asideInk: Ink = { heading: accent, body: "#2a2a2a", muted: "#5c5c5c", rule: accent };
  for (const key of ["skills", "education", "certifications", "contact"]) {
    sectionInto(aside, key, c, asideInk, { stackContact: true });
  }
  for (const el of aside.out) if (el.type === "line") el.opacity = 0.4;
  out.push(...aside.out);

  const main = new Column(M + asideW + 10, top + 2, A4.w - M * 2 - asideW - 10);
  for (const key of ["summary", "experience", "projects", "achievements"]) {
    sectionInto(main, key, c, ink, {});
  }
  out.push(...main.out);
  return out;
}

/* ------------------------------------------------------------------ entry */

/**
 * A design, from a résumé and a template id.
 *
 * The result is always at least one page and is always renderable, including
 * for somebody who has typed nothing yet — an empty résumé seeds placeholder
 * headings rather than a blank sheet, because a blank sheet gives a person
 * nothing to click and nothing to change.
 */
export function seedDesign(content: Resume, templateId: string | null | undefined): Design {
  const t = templateById(templateId);
  const elements = LAYOUTS[t.layout](content, t);

  /**
   * Anything past the bottom of sheet one moves to sheet two.
   *
   * A crude split — whole elements, by their top edge, no reflow — and that is
   * the honest behaviour for a canvas: an element is a thing with a position,
   * so it either fits or it moves. It is also visible and fixable, which a
   * silently clipped page is not.
   *
   * Splitting on the **bottom** edge instead — so a block that would cross the
   * boundary moves whole — looks like the obvious improvement and was tried.
   * It is not, without a reflow to go with it: a paragraph at 290mm bumped to
   * the next sheet lands at 290 − 297 = −7mm, above the top of its own page,
   * and every block after it keeps the offset it had, so the two overlap. Page
   * breaks need the rest of the column to move down with them, and that is a
   * flow engine, not a modulo. Until there is one, a block that straddles the
   * boundary stays where the person put it and the page clips it, which is at
   * least a thing they can see and drag.
   *
   * The gallery does not have to live with that, because a card is a picture
   * rather than a document: `previewDesign` trims sheet one to the last block
   * that fits whole. See `design-sample.ts`.
   */
  const pages: Page[] = [blankPage()];
  for (const el of elements) {
    const index = Math.max(0, Math.floor(el.y / A4.h));
    while (pages.length <= index) pages.push(blankPage());
    pages[index].elements.push(index ? { ...el, y: el.y - index * A4.h } : el);
  }

  return { version: 1, pages };
}

/* ------------------------------------------------------- the new layouts */

/**
 * A coloured column with the photo at the top of it.
 *
 * The most common shape in the reference set, and the one that carries the
 * widest range: the column can be dark or light, the page can be tinted or
 * white, and changing those two colours is most of what separates six of the
 * designs from each other. Everything structural is here once.
 */
function photoSidebarLayout(c: Resume, t: Template): Element[] {
  const wash = t.theme.wash ?? "#2f3640";
  const asideText = t.theme.asideText ?? t.theme.onAccent ?? "#ffffff";
  const asideHeading = t.theme.asideHeading ?? asideText;
  const accent = t.theme.accent ?? asideHeading;
  const asideW = t.theme.asideMm ?? 68;
  const photo = showsPhoto(t) ? Math.min(38, asideW - 18) : 0;

  const out: Element[] = [shape({ x: 0, y: 0, w: asideW, h: A4.h, fill: wash })];
  if (photo) out.push(photoFrame(asideW / 2 - photo / 2, 16, photo));

  // Without a frame the column starts where the frame would have, not below
  // where it would have ended — otherwise the design keeps its hole.
  const aside = new Column(10, photo ? 16 + photo + 9 : 18, asideW - 20);
  const asideInk: Ink = { heading: asideHeading, body: asideText, muted: asideText, rule: asideText };

  aside.text("Contact", { size: 10.5, bold: true, color: asideHeading, lineHeight: 1.2 });
  aside.rule(asideText, { gap: 1.4 });
  iconContact(aside, c, asideInk);

  if (c.skills.length) {
    aside.text("Skills", { gap: 6, size: 10.5, bold: true, color: asideHeading, lineHeight: 1.2 });
    aside.rule(asideText, { gap: 1.4 });
    // The meters take the *sidebar's* heading colour, not the page accent.
    // On a dark column those two are usually the same hex — `accent` and
    // `wash` are both the navy — and five navy dots on a navy panel is a
    // section that renders as nothing at all. It passed the element count and
    // it passed typecheck; it only failed by being looked at.
    if (t.theme.skillMeters) skillMeters(aside, c.skills, asideInk, asideHeading);
    else aside.text(c.skills.join("\n"), { gap: 2.4, size: 9, color: asideText, lineHeight: 1.55 });
  }

  for (const key of ["education", "certifications"]) {
    sectionInto(aside, key, c, asideInk, { stackContact: true });
  }
  for (const el of aside.out) if (el.type === "line") el.opacity = 0.45;
  out.push(...aside.out);

  // The right-hand column: the name, then the substance.
  const mainX = asideW + 12;
  const main = new Column(mainX, 20, A4.w - mainX - M);
  const ink: Ink = { heading: accent, body: "#1c1c1c", muted: "#6b6b6b", rule: "#dcdcdc" };

  main.text(c.full_name ?? "Your name", { size: 24, bold: true, color: ink.heading, lineHeight: 1.1 });
  main.text(c.headline ?? "", { gap: 1.4, size: 11.5, color: ink.muted, lineHeight: 1.3 });
  main.rule(ink.rule, { gap: 3.4 });

  for (const key of ["summary", "experience", "projects", "achievements"]) {
    sectionInto(main, key, c, ink, {});
  }
  out.push(...main.out);
  return out;
}

/**
 * A colour band across the top, with the photo inside it.
 *
 * Distinct from `bandLayout` in one way that matters: the body below is two
 * columns rather than one, which is what the reference designs use the saved
 * vertical space for.
 */
function headerPhotoLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#2f3640";
  const onAccent = t.theme.onAccent ?? "#ffffff";
  const bandH = t.theme.bandMm ?? 54;
  const ink: Ink = { heading: accent, body: "#1c1c1c", muted: "#6b6b6b", rule: "#dcdcdc" };
  const photo = showsPhoto(t) ? bandH - 16 : 0;

  const out: Element[] = [shape({ x: 0, y: 0, w: A4.w, h: bandH, fill: accent })];
  if (photo) out.push(photoFrame(M, (bandH - photo) / 2, photo));

  const headX = photo ? M + photo + 10 : M;
  const head = new Column(headX, bandH / 2 - 13, A4.w - headX - M);
  head.text(c.full_name ?? "Your name", { size: 23, bold: true, color: onAccent, lineHeight: 1.1 });
  head.text(c.headline ?? "", { gap: 1.4, size: 11, color: onAccent, opacity: 0.85, lineHeight: 1.3 });
  out.push(...head.out);

  // Two columns under the band, narrow on the left.
  const asideW = 60;
  const aside = new Column(M, bandH + 12, asideW);
  iconHeading(aside, "About me", "user", ink, { gap: 0 });
  aside.text(c.summary ?? "", { gap: 1.6, size: 8.8, color: ink.body, lineHeight: 1.45 });
  iconHeading(aside, "Contact", "phone", ink);
  iconContact(aside, c, ink);
  if (c.skills.length) {
    iconHeading(aside, "Skills", "skills", ink);
    aside.text(c.skills.join("\n"), { gap: 1.6, size: 8.8, color: ink.body, list: "bullet", lineHeight: 1.5 });
  }
  /**
   * Certifications and awards, in the narrow column.
   *
   * These were missing, and the omission was invisible until the sample
   * résumé got long enough to notice: this layout drew a summary, contact,
   * skills, education and experience, and silently dropped the other three
   * sections a résumé can hold. Rendered against a full CV it stopped two
   * thirds of the way down the page while every other layout ran to the
   * bottom — the four templates on it looked like the *thin* ones, when in
   * fact they were the ones throwing content away.
   *
   * Dropping somebody's certifications because the template that draws them
   * forgot to is the worst kind of bug: nothing errors, nothing looks broken,
   * and the person never learns their award is not on the page they sent.
   */
  if (c.certifications.length) {
    iconHeading(aside, "Certifications", "award", ink);
    aside.text(c.certifications.join("\n"), { gap: 1.6, size: 8.8, color: ink.body, list: "bullet", lineHeight: 1.5 });
  }
  out.push(...aside.out);

  const mainX = M + asideW + 12;
  const main = new Column(mainX, bandH + 12, A4.w - mainX - M);
  iconHeading(main, "Education", "cap", ink, { gap: 0 });
  timelineEntries(main, educationBlocks(c).map((e) => ({ ...e, bullets: "" })), ink, accent);
  iconHeading(main, "Experience", "briefcase", ink);
  timelineEntries(main, roleBlocks(c), ink, accent);
  const projects = projectBlocks(c);
  if (projects.length) {
    iconHeading(main, "Projects", "star", ink);
    timelineEntries(main, projects, ink, accent);
  }
  if (c.achievements.length) {
    iconHeading(main, "Achievements", "quote", ink);
    main.text(c.achievements.join("\n"), {
      gap: 1.6,
      size: 9.2,
      color: ink.body,
      list: "bullet",
      lineHeight: 1.45,
      indent: 7,
    });
  }
  out.push(...main.out);

  return out;
}

/**
 * Two columns divided by a rule, and no colour at all.
 *
 * The quietest of the set. Its whole character is the vertical hairline down
 * the middle and the markers that sit on it, so those are the only decoration
 * — anything else added here would make it a different template.
 */
function ruleSplitLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#1c1c1c";
  // Headings in the accent, not in black.
  //
  // The first version painted the accent onto the divider and the two markers
  // and nothing else. Rendered, the five templates in this family were the
  // same document five times: the rule is a third of a millimetre wide at 50%
  // opacity, so a slate rule and a black one are indistinguishable, and two of
  // them had no tint at all. A colour that only appears on a hairline is a
  // colour the person choosing it will never see.
  const ink: Ink = { heading: accent, body: "#1c1c1c", muted: "#6b6b6b", rule: "#d9d9d9" };
  const out: Element[] = [];

  // A centred name in a soft band, as the reference draws it.
  const bandY = 18;
  const bandH = 20;
  if (t.theme.wash) out.push(shape({ x: 0, y: bandY, w: A4.w, h: bandH, fill: t.theme.wash }));

  const head = new Column(M, bandY + 3.5, A4.w - M * 2);
  head.text(c.full_name ?? "Your name", {
    size: 20, bold: false, caps: true, letterSpacing: 0.1, align: "center", color: ink.heading, lineHeight: 1.15,
  });
  head.text(c.headline ?? "", { gap: 1, size: 10, align: "center", color: ink.muted });
  out.push(...head.out);

  const top = bandY + bandH + 14;
  const gutter = A4.w / 2;
  out.push(shape({ x: gutter, y: top, w: 0.3, h: A4.h - top - 22, fill: accent, opacity: 0.5 }));

  const photo = showsPhoto(t) ? 30 : 0;
  if (photo) out.push(photoFrame(M, top, photo));

  const left = new Column(M, top + (photo ? photo + 8 : 0), gutter - M - 10);
  const leftInk = ink;
  left.text("Contact", { size: 10.5, bold: true, caps: true, letterSpacing: 0.06, color: ink.heading });
  iconContact(left, c, leftInk);
  for (const key of ["education", "skills", "certifications"]) {
    sectionInto(left, key, c, leftInk, { stackContact: true });
  }
  out.push(...left.out);

  const right = new Column(gutter + 10, top, A4.w - gutter - 10 - M);
  right.text("Personal statement", { size: 10.5, bold: true, caps: true, letterSpacing: 0.06, color: ink.heading });
  right.text(c.summary ?? "", { gap: 1.8, size: 9, color: ink.body, lineHeight: 1.5 });
  for (const key of ["experience", "projects", "achievements"]) {
    sectionInto(right, key, c, ink, {});
  }
  out.push(...right.out);

  /**
   * The diamonds that cap the rule.
   *
   * They were at `top + 1` and `top + 60` — the first is the top of the rule,
   * the second is sixty millimetres down it, which is a number and not a
   * place. Rendered, it landed beside a degree title in the right-hand column
   * and read as a bullet somebody had misplaced. End caps instead: both ends
   * of the line, which is where the eye already expects a terminal.
   */
  const ruleBottom = A4.h - 22;
  for (const y of [top - 1.8, ruleBottom - 1.8]) {
    out.push(shape({ x: gutter - 1.8, y, w: 3.6, h: 3.6, shape: "diamond", fill: accent }));
  }
  return out;
}

/**
 * Section labels in a left gutter, content in one wide measure.
 *
 * The most unusual of the references and the most legible: nothing competes
 * with the text, and the labels read as an index down the side.
 */
function labelLeftLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#1c1c1c";
  /**
   * The accent lands on the gutter labels, and on nothing else.
   *
   * It previously landed nowhere: the only element carrying it was a
   * zero-height shape at `opacity: 0`, left over from working out where the
   * gutter sat. Four of the five templates in this family therefore rendered
   * as the same black-and-white page, and the gallery offered somebody a
   * choice between a blue one and a green one that were byte-identical.
   *
   * The labels are the right place for it and the only place. They are the
   * one part of this design that is furniture rather than content, so tinting
   * them separates the templates without touching a word anybody wrote — and
   * putting it on the body text instead would have made the quietest layout
   * in the set the loudest.
   */
  const ink: Ink = { heading: "#1c1c1c", body: "#1c1c1c", muted: "#7a7a7a", rule: "#e2e2e2" };
  const labelW = 34;
  const bodyX = M + labelW + 10;
  const bodyW = A4.w - bodyX - M;
  const out: Element[] = [];

  const photo = showsPhoto(t) ? 26 : 0;
  if (photo) out.push(photoFrame(bodyX, 16, photo));

  const headX = photo ? bodyX + photo + 6 : bodyX;
  const head = new Column(headX, 18, bodyW - (headX - bodyX));
  head.text(contactLine(c), { size: 8.2, color: ink.muted, lineHeight: 1.4 });
  head.text(c.full_name ?? "Your name", { gap: 1.6, size: 19, bold: true, color: ink.heading, lineHeight: 1.15 });
  head.text(c.summary ?? "", { gap: 1.6, size: 10.5, color: ink.body, lineHeight: 1.45 });
  out.push(...head.out);

  let y = Math.max(head.bottom, 16 + photo) + 12;
  const rows: { label: string; run: (col: Column) => void }[] = [
    { label: "Skills", run: (col) => { col.text(c.skills.join("\n"), { size: 9, color: ink.body, list: "bullet", lineHeight: 1.5 }); } },
    { label: "Employment History", run: (col) => entries(col, roleBlocks(c), ink) },
    /**
     * Projects, certifications and achievements were missing here, exactly as
     * they were missing from `headerPhotoLayout`, and for the same reason: the
     * layouts were written against a two-job sample that had nothing in those
     * fields, so nobody noticed there was no code to draw them.
     *
     * A row renders nothing when its section is empty — `body.out.length` below
     * is the check — so adding them costs a thin résumé nothing and stops a
     * full one having a third of itself silently dropped.
     */
    { label: "Projects", run: (col) => entries(col, projectBlocks(c), ink) },
    { label: "Education", run: (col) => { for (const e of educationBlocks(c)) { col.text(e.head, { gap: 2.6, size: 10, bold: true, color: ink.body, lineHeight: 1.25 }); col.text(e.dates, { gap: 0.5, size: 8.5, color: ink.muted }); } } },
    { label: "Certifications", run: (col) => { col.text(c.certifications.join("\n"), { size: 9, color: ink.body, list: "bullet", lineHeight: 1.5 }); } },
    { label: "Achievements", run: (col) => { col.text(c.achievements.join("\n"), { size: 9, color: ink.body, list: "bullet", lineHeight: 1.5 }); } },
    { label: "References", run: (col) => { col.text("Available on request", { size: 10, bold: true, color: ink.body }); } },
  ];

  for (const row of rows) {
    const body = new Column(bodyX, y, bodyW);
    row.run(body);
    if (!body.out.length) continue;
    out.push(
      text({
        text: row.label,
        x: M,
        y,
        w: labelW,
        h: 6,
        size: 8.8,
        bold: true,
        color: accent,
        lineHeight: 1.3,
      }),
    );
    // A short mark under each label, so the gutter reads as an index rather
    // than as four stray words down the margin.
    out.push(shape({ x: M, y: y + 5.2, w: 9, h: 0.35, fill: accent, opacity: 0.55 }));
    out.push(...body.out);
    y = body.bottom + 9;
  }

  return out;
}

/* ------------------------------------------------- the second six layouts */

/**
 * The sidebar, on the other side.
 *
 * Not a trick to pad the list. A résumé is read left to right, so which side
 * the narrow column sits on decides what somebody sees *first* — a right
 * sidebar leads with the name and the work and puts skills and dates second,
 * which is the opposite emphasis to `photo-sidebar` and the one most hiring
 * managers say they prefer. `sectionOrder` records the difference so the ATS
 * score follows the page rather than the family.
 */
function rightSidebarLayout(c: Resume, t: Template): Element[] {
  const wash = t.theme.wash ?? "#eef1f4";
  const asideText = t.theme.asideText ?? t.theme.onAccent ?? "#ffffff";
  const asideHeading = t.theme.asideHeading ?? asideText;
  const accent = t.theme.accent ?? "#1c1c1c";
  const asideW = t.theme.asideMm ?? 64;
  const asideX = A4.w - asideW;
  const photo = showsPhoto(t) ? Math.min(34, asideW - 18) : 0;

  const out: Element[] = [shape({ x: asideX, y: 0, w: asideW, h: A4.h, fill: wash })];
  if (photo) out.push(photoFrame(asideX + asideW / 2 - photo / 2, 16, photo));

  const aside = new Column(asideX + 10, photo ? 16 + photo + 9 : 18, asideW - 20);
  const asideInk: Ink = { heading: asideHeading, body: asideText, muted: asideText, rule: asideText };
  aside.text("Contact", { size: 10.5, bold: true, color: asideHeading, lineHeight: 1.2 });
  aside.rule(asideText, { gap: 1.4 });
  iconContact(aside, c, asideInk);
  if (c.skills.length) {
    aside.text("Skills", { gap: 6, size: 10.5, bold: true, color: asideHeading, lineHeight: 1.2 });
    aside.rule(asideText, { gap: 1.4 });
    if (t.theme.skillMeters) skillMeters(aside, c.skills, asideInk, asideHeading);
    else aside.text(c.skills.join("\n"), { gap: 2.4, size: 9, color: asideText, lineHeight: 1.55 });
  }
  for (const key of ["education", "certifications"]) sectionInto(aside, key, c, asideInk, { stackContact: true });
  for (const el of aside.out) if (el.type === "line") el.opacity = 0.45;
  out.push(...aside.out);

  const main = new Column(M, 18, asideX - M - 12);
  const ink: Ink = { heading: accent, body: "#1c1c1c", muted: "#6b6b6b", rule: "#dcdcdc" };
  main.text(c.full_name ?? "Your name", { size: 24, bold: true, color: accent, lineHeight: 1.1 });
  main.text(c.headline ?? "", { gap: 1.4, size: 11.5, color: ink.muted, lineHeight: 1.3 });
  main.rule(ink.rule, { gap: 3.4 });
  for (const key of ["summary", "experience", "projects", "achievements"]) sectionInto(main, key, c, ink, {});
  out.push(...main.out);
  return out;
}

/**
 * Every section in its own tinted box.
 *
 * The one shape in the set with no shared vertical rhythm: each block is a
 * panel with its own edge, so the page reads as a set of cards rather than as
 * a run of text. It costs the most vertical space of any layout here — a
 * panel needs padding above and below the words — and buys the clearest
 * scanning, which is the trade a person picking this one is making.
 *
 * The panel is drawn after its contents, for the same reason the timeline rail
 * is: the height is only known once the words are laid out.
 */
function boxedLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#1c1c1c";
  const wash = t.theme.wash ?? "#f4f5f7";
  const ink: Ink = { heading: accent, body: "#1c1c1c", muted: "#6b6b6b", rule: "#dcdcdc" };
  const out: Element[] = [];
  const photo = showsPhoto(t) ? 26 : 0;

  const headX = photo ? M + photo + 8 : M;
  const head = new Column(headX, 16, A4.w - headX - M);
  head.text(c.full_name ?? "Your name", { size: 22, bold: true, color: accent, lineHeight: 1.12 });
  head.text(c.headline ?? "", { gap: 1.2, size: 11, color: ink.muted });
  head.text(contactLine(c), { gap: 1.6, size: 8.6, color: ink.muted });
  if (photo) out.push(photoFrame(M, 16, photo));
  out.push(...head.out);

  let y = Math.max(head.bottom, 16 + photo) + 8;
  const PAD = 4.5;

  const panel = (label: string, run: (col: Column) => void) => {
    const body = new Column(M + PAD, y + PAD + 6.5, A4.w - M * 2 - PAD * 2);
    run(body);
    if (!body.out.length) return;
    const h = body.bottom - y + PAD;
    out.push(shape({ x: M, y, w: A4.w - M * 2, h, fill: wash, radius: 2 }));
    out.push(
      text({ text: label.toUpperCase(), x: M + PAD, y: y + PAD, w: 80, h: 5,
        size: 8.5, bold: true, letterSpacing: 0.1, color: accent, lineHeight: 1.2 }),
    );
    out.push(...body.out);
    y += h + 4;
  };

  panel("Profile", (col) => { col.text(c.summary ?? "", { size: 9.4, color: ink.body, lineHeight: 1.45 }); });
  panel("Experience", (col) => entries(col, roleBlocks(c), ink));
  panel("Projects", (col) => entries(col, projectBlocks(c), ink));
  panel("Education", (col) => {
    for (const e of educationBlocks(c)) {
      col.text(e.head, { gap: 2.4, size: 10, bold: true, color: ink.body, lineHeight: 1.25 });
      col.text(e.dates, { gap: 0.5, size: 8.5, color: ink.muted });
    }
  });
  panel("Skills", (col) => { col.text(c.skills.join(" · "), { size: 9.4, color: ink.body, lineHeight: 1.5 }); });
  panel("Certifications", (col) => { col.text(c.certifications.join("\n"), { size: 9.4, color: ink.body, list: "bullet", lineHeight: 1.45 }); });
  panel("Achievements", (col) => { col.text(c.achievements.join("\n"), { size: 9.4, color: ink.body, list: "bullet", lineHeight: 1.45 }); });
  return out;
}

/**
 * A deep colour block at the top, carrying the name and the summary.
 *
 * `band` puts the contact line in the block; this puts the whole opening
 * paragraph there, which is a different document: the first thing read is the
 * pitch rather than the phone number. That only works if the block is deep
 * enough to hold four lines of text, hence the larger default.
 */
function topBannerLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#22303c";
  const onAccent = t.theme.onAccent ?? "#ffffff";
  const bandH = t.theme.bandMm ?? 72;
  const ink: Ink = { heading: accent, body: "#1c1c1c", muted: "#6b6b6b", rule: "#dcdcdc" };
  const photo = showsPhoto(t) ? Math.min(38, bandH - 20) : 0;

  const out: Element[] = [shape({ x: 0, y: 0, w: A4.w, h: bandH, fill: accent })];
  if (photo) out.push(photoFrame(A4.w - M - photo, (bandH - photo) / 2, photo));

  const headW = A4.w - M * 2 - (photo ? photo + 10 : 0);
  const head = new Column(M, 14, headW);
  head.text(c.full_name ?? "Your name", { size: 25, bold: true, color: onAccent, lineHeight: 1.08 });
  head.text(c.headline ?? "", { gap: 1.2, size: 11.5, color: onAccent, opacity: 0.85 });
  head.text(c.summary ?? "", { gap: 2.6, size: 9, color: onAccent, opacity: 0.9, lineHeight: 1.45 });
  head.text(contactLine(c), { gap: 2.4, size: 8.4, color: onAccent, opacity: 0.8 });
  out.push(...head.out);

  const asideW = 58;
  const aside = new Column(M, bandH + 12, asideW);
  const asideInk: Ink = { ...ink, rule: "#e2e2e2" };
  for (const key of ["skills", "education", "certifications"]) sectionInto(aside, key, c, asideInk, {});
  out.push(...aside.out);

  const mainX = M + asideW + 12;
  const main = new Column(mainX, bandH + 12, A4.w - mainX - M);
  for (const key of ["experience", "projects", "achievements"]) sectionInto(main, key, c, ink, {});
  out.push(...main.out);
  return out;
}

/**
 * The whole document hung off one rail.
 *
 * `header-photo` uses a timeline for two sections inside a narrow column; this
 * gives the rail the full measure and runs every dated section down it, so the
 * page reads as one chronology rather than as a set of lists. Undated sections
 * — skills, certifications — sit below it, off the rail, because putting an
 * undated thing on a timeline is a claim the résumé does not make.
 */
function railTimelineLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#1c1c1c";
  const ink: Ink = { heading: accent, body: "#1c1c1c", muted: "#6b6b6b", rule: "#dcdcdc" };
  const out: Element[] = [];
  const photo = showsPhoto(t) ? 28 : 0;

  const headX = photo ? M + photo + 9 : M;
  const head = new Column(headX, 16, A4.w - headX - M);
  head.text(c.full_name ?? "Your name", { size: 24, bold: true, color: accent, lineHeight: 1.1 });
  head.text(c.headline ?? "", { gap: 1.2, size: 11.5, color: ink.muted });
  head.text(contactLine(c), { gap: 1.8, size: 8.6, color: ink.muted });
  if (photo) out.push(photoFrame(M, 16, photo));
  out.push(...head.out);

  const col = new Column(M, Math.max(head.bottom, 16 + photo) + 8, A4.w - M * 2);
  col.text(c.summary ?? "", { size: 9.6, color: ink.body, lineHeight: 1.5 });

  iconHeading(col, "Experience", "briefcase", ink);
  timelineEntries(col, roleBlocks(c), ink, accent);
  const projects = projectBlocks(c);
  if (projects.length) {
    iconHeading(col, "Projects", "star", ink);
    timelineEntries(col, projects, ink, accent);
  }
  iconHeading(col, "Education", "cap", ink);
  timelineEntries(col, educationBlocks(c).map((e) => ({ ...e, bullets: "" })), ink, accent);

  if (c.skills.length) {
    iconHeading(col, "Skills", "skills", ink);
    col.text(c.skills.join(" · "), { gap: 1.6, size: 9.4, color: ink.body, lineHeight: 1.5 });
  }
  if (c.certifications.length) {
    iconHeading(col, "Certifications", "award", ink);
    col.text(c.certifications.join("\n"), { gap: 1.6, size: 9.4, color: ink.body, list: "bullet", lineHeight: 1.45 });
  }
  out.push(...col.out);
  return out;
}

/**
 * A block of colour with the person's initials in it, top left.
 *
 * The one design here that needs no photograph and does not look like it is
 * missing one — which is the point of keeping it. Plenty of people do not want
 * a face on their résumé and every other bold design in the set is built
 * around one; this gives them the same weight at the top of the page without
 * it. The initials come from the name, so it is never empty and never someone
 * else's picture.
 */
function initialBlockLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#1c1c1c";
  const onAccent = t.theme.onAccent ?? "#ffffff";
  const ink: Ink = { heading: accent, body: "#1c1c1c", muted: "#6b6b6b", rule: "#dcdcdc" };
  const box = 34;
  const out: Element[] = [];

  /**
   * A face in the block, not two letters.
   *
   * This layout shipped with initials in the block and the reasoning was that
   * a monogram can never be empty and can never be a picture of somebody else.
   * Both of those are true and neither is what a person wants when they look
   * at the card: a résumé with "AR" where the photograph goes reads as a
   * profile that failed to load its picture, not as a design choice. Nobody
   * puts their initials on a CV.
   *
   * So a template on this layout normally reserves a frame, and the initials
   * are what it draws when one deliberately does not — `showsPhoto` decides,
   * per template, as everywhere else. They cannot be stacked: an empty frame
   * paints its own "drop a photo here" placeholder, which would cover a
   * monogram sitting behind it, so this is a choice rather than a fallback.
   */
  if (showsPhoto(t)) {
    out.push(photoFrame(M, 16, box, "rect"));
  } else {
    out.push(shape({ x: M, y: 16, w: box, h: box, fill: accent, radius: 2 }));
    const initials = (c.full_name ?? "Your name")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
    out.push(
      text({ text: initials || "CV", x: M, y: 16 + box / 2 - 8, w: box, h: 16,
        size: 20, bold: true, align: "center", color: onAccent, lineHeight: 1.1 }),
    );
  }

  const headX = M + box + 10;
  const head = new Column(headX, 18, A4.w - headX - M);
  head.text(c.full_name ?? "Your name", { size: 23, bold: true, color: accent, lineHeight: 1.1 });
  head.text(c.headline ?? "", { gap: 1.2, size: 11, color: ink.muted });
  head.text(contactLine(c), { gap: 1.8, size: 8.6, color: ink.muted });
  out.push(...head.out);

  const top = Math.max(head.bottom, 16 + box) + 10;
  const asideW = 56;
  const aside = new Column(M, top, asideW);
  for (const key of ["skills", "certifications", "education"]) sectionInto(aside, key, c, ink, {});
  out.push(...aside.out);

  const mainX = M + asideW + 12;
  const main = new Column(mainX, top, A4.w - mainX - M);
  for (const key of ["summary", "experience", "projects", "achievements"]) sectionInto(main, key, c, ink, {});
  out.push(...main.out);
  return out;
}

/**
 * Clean at the top, a band of colour along the foot.
 *
 * Unusual, and worth having for a reason that is not novelty: it is the only
 * design here that gives the *first* line of the page to the name in plain
 * black on white, which is what an applicant tracking system parses best,
 * while still being a coloured template somebody would choose from a gallery.
 * The band carries the contact details, so the colour has a job rather than
 * being decoration at the bottom of the sheet.
 */
function footerBandLayout(c: Resume, t: Template): Element[] {
  const accent = t.theme.accent ?? "#1c1c1c";
  const onAccent = t.theme.onAccent ?? "#ffffff";
  const ink: Ink = { heading: accent, body: "#1c1c1c", muted: "#6b6b6b", rule: "#dcdcdc" };
  const bandH = t.theme.bandMm ?? 26;
  const bandY = A4.h - bandH;
  const out: Element[] = [shape({ x: 0, y: bandY, w: A4.w, h: bandH, fill: accent })];

  const photo = showsPhoto(t) ? 26 : 0;
  const headX = photo ? M + photo + 9 : M;
  if (photo) out.push(photoFrame(M, 16, photo));

  const head = new Column(headX, 17, A4.w - headX - M);
  head.text(c.full_name ?? "Your name", {
    size: 24, bold: true, caps: true, letterSpacing: 0.03, color: "#111111", lineHeight: 1.1,
  });
  head.text(c.headline ?? "", { gap: 1.4, size: 11.5, color: accent });
  out.push(...head.out);
  out.push(line({ x: M, y: Math.max(head.bottom, 16 + photo) + 4, w: A4.w - M * 2, h: 0.6, stroke: accent, strokeWidth: 0.6 }));

  const top = Math.max(head.bottom, 16 + photo) + 12;
  const asideW = 56;
  const aside = new Column(M, top, asideW);
  for (const key of ["skills", "education", "certifications"]) sectionInto(aside, key, c, ink, {});

  const mainX = M + asideW + 12;
  const main = new Column(mainX, top, A4.w - mainX - M);
  for (const key of ["summary", "experience", "projects", "achievements"]) sectionInto(main, key, c, ink, {});

  /**
   * Both columns stop above the band.
   *
   * Without this the long column simply ran on and the band, drawn last,
   * painted over the end of it — two lines of somebody's last project sitting
   * *underneath* a block of colour, still there, no longer readable. Clipping
   * at a page edge is at least legible as an edge; this looked like the
   * renderer had lost the text. Per column, because the narrow one usually
   * fits and should not be broken just because the wide one did not.
   */
  const limit = bandY - 6;
  out.push(...breakAbove(aside.out, limit), ...breakAbove(main.out, limit));

  // The contact details live in the band, spread across it.
  out.push(
    text({ text: contactLine(c), x: M, y: bandY + bandH / 2 - 3, w: A4.w - M * 2, h: 6,
      size: 8.8, align: "center", color: onAccent, lineHeight: 1.3 }),
  );
  return out;
}

/* ------------------------------------------------------------ the mapping */

/**
 * Layout name to the function that draws it.
 *
 * A table rather than the chain of ternaries this replaced, for one reason
 * that is worth more than the tidiness: it is `Record<Layout, …>`, so adding a
 * member to `Layout` without writing the function to draw it is a type error
 * here rather than a résumé that silently renders as a plain column. The chain
 * ended in `: columnLayout(…)`, which meant every unhandled layout quietly
 * became the default one — the four new designs would have shipped looking
 * identical and nothing would have complained.
 */
const LAYOUTS: Record<Layout, (c: Resume, t: Template) => Element[]> = {
  column: (c, t) => columnLayout(c, t, t.id === "centred-serif"),
  band: bandLayout,
  sidebar: sidebarLayout,
  split: splitLayout,
  "photo-sidebar": photoSidebarLayout,
  "header-photo": headerPhotoLayout,
  "rule-split": ruleSplitLayout,
  "label-left": labelLeftLayout,
  "right-sidebar": rightSidebarLayout,
  boxed: boxedLayout,
  "top-banner": topBannerLayout,
  "rail-timeline": railTimelineLayout,
  "initial-block": initialBlockLayout,
  "footer-band": footerBandLayout,
};
