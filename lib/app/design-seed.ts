import {
  A4,
  blankPage,
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
import { templateById, type Template } from "@/lib/app/resume-templates";

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

  space(mm: number) {
    this.y += mm;
  }

  push(el: Element) {
    this.out.push(el);
    return el;
  }

  /** A block of text, sized to what it will probably take. */
  text(body: string, opts: Partial<TextElement> & { gap?: number } = {}): TextElement | null {
    if (!body.trim()) return null;
    const { gap = 0, ...rest } = opts;
    this.y += gap;
    const size = rest.size ?? 10;
    const lh = rest.lineHeight ?? 1.35;
    // A list draws a marker in the same column as the words, so its lines are
    // shorter and it wraps sooner. Roughly a marker plus its gap.
    const usable = rest.list && rest.list !== "none" ? this.w - size * PT * 1.2 : this.w;
    const h = estimateHeight(body, usable, size, lh, { bold: rest.bold, caps: rest.caps });
    const el = text({ ...rest, text: body, x: this.x, y: this.y, w: this.w, h });
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
 * Not every template. `showsPhoto()` in resume-templates.ts is the rule and it
 * predates this file: **banded and sidebar layouts only**. Those two reserve a
 * block of colour that a picture can live in — both of them were already
 * drawing a monogram there, which is a placeholder for a face by another name.
 *
 * The plain column and the two-column split are deliberately without one. In
 * both, the only way to fit a photo is to take the space from the words: a
 * frame top-right narrows the name, and one at the top of the split's aside
 * costs four centimetres of the tightest column on the page. A template should
 * not spend somebody's layout on a picture they may not want — and if they do
 * want it, the Frames panel puts one anywhere in two clicks.
 *
 * Empty is the point. It says "your photo goes here", it fills by dropping a
 * file on it, and if it is never filled it prints as nothing at all.
 */
function photoFrame(x: number, y: number, size: number, shapeKind: "circle" | "rect" = "circle") {
  return image({ x, y, w: size, h: size, shape: shapeKind, radius: shapeKind === "rect" ? 3 : 0 });
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
   */
  const col = new Column(M, M, A4.w - M * 2);

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
  return col.out;
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

  out.push(photoFrame(A4.w - M - 26, (bandH - 26) / 2, 26));

  const head = new Column(M, 12, A4.w - M * 2 - 34);
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
  out.push(photoFrame(asideW / 2 - 13, 13, 26));
  aside.space(30);

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

  // No frame here either: the aside is a narrow column of skills and dates
  // that runs the height of the page, and a photo at the top of it costs four
  // centimetres of the one column that was already the tightest.
  const aside = new Column(M + 7, top + 8, asideW - 14);
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
  const elements =
    t.layout === "band"
      ? bandLayout(content, t)
      : t.layout === "sidebar"
        ? sidebarLayout(content, t)
        : t.layout === "split"
          ? splitLayout(content, t)
          : columnLayout(content, t, t.id === "centred-serif");

  /**
   * Anything past the bottom of sheet one moves to sheet two.
   *
   * A crude split — whole elements, by their top edge, no reflow — and that is
   * the honest behaviour for a canvas: an element is a thing with a position,
   * so it either fits or it moves. It is also visible and fixable, which a
   * silently clipped page is not.
   */
  const pages: Page[] = [blankPage()];
  for (const el of elements) {
    const index = Math.max(0, Math.floor(el.y / A4.h));
    while (pages.length <= index) pages.push(blankPage());
    pages[index].elements.push(index ? { ...el, y: el.y - index * A4.h } : el);
  }

  return { version: 1, pages };
}
