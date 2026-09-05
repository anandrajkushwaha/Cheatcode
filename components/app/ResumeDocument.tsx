import type { Resume as DraftContent } from "@/lib/app/resume-schema";
import {
  EMPTY_PRESENTATION,
  GOOGLE_FONTS_HREF,
  styleToCss,
  type Presentation,
} from "@/lib/app/resume-style";
import {
  sectionOrder,
  templateById,
  themeVars,
  type Layout,
  type SectionKey,
} from "@/lib/app/resume-templates";

/**
 * The document.
 *
 * It renders four structures — a plain column, a coloured header band, a left
 * sidebar, and a two-column body — from one set of section components. Which
 * sections go in which column is decided by `sectionOrder()`, not here, so the
 * scorer and the renderer read the same definition and cannot drift.
 *
 * It also renders three ways: as a printable page, as a thumbnail in the
 * gallery, and as the thing somebody types into. The editing behaviour is a
 * prop rather than a second component, which is what stops an editable twin of
 * this markup existing and slowly disagreeing with the original.
 *
 * A note on what the layouts cost. A single column is what an applicant
 * tracking system reads best; a sidebar is genuinely worse, because a parser
 * going left to right reads the contact block as an employer and the skills as
 * part of whatever followed. That is a real trade, and the honest place to
 * surface it is a score on the template card. The machinery for that is
 * `sectionOrder()`; the number is not on screen yet.
 */

const A4 = { width: "210mm" };

/**
 * Layout classes are prefixed `rd-l-`, and that prefix is load-bearing.
 *
 * Without it the page carried `rd-band` for its layout while the header
 * element also used `.rd-band` for its colour and padding — so the whole
 * A4 page turned navy and every heading became invisible against it. The
 * names looked unrelated in two different files and collided in one class
 * attribute. Element classes stay `rd-<thing>`; layout modifiers are
 * `rd-l-<layout>`, and the two namespaces cannot meet.
 */

/* ---------------------------------------------------------------- editing */

/**
 * A path into the content tree, as a string: `full_name`, `roles.0.title`,
 * `roles.2.highlights.1`. Strings rather than typed accessors because they
 * also go on the DOM node as `data-path`, which is what lets a keystroke in a
 * bullet resolve back to which bullet it was.
 */
export type Edit = {
  set: (path: string, value: string) => void;
  /**
   * Which field the caret is in, so a toolbar can act on it.
   *
   * Reported and never cleared. Clearing on blur would be tidier and would
   * break the toolbar completely: clicking a button blurs the field, so the
   * selection would be gone by the time the click landed.
   */
  select?: (path: string) => void;
  /**
   * Enter was pressed in a bullet: add an empty one after it. Returns the new
   * bullet's path so the caret can follow it there.
   */
  splitBullet: (path: string) => string | null;
  /** Backspace at the start of an already-empty bullet: delete it. */
  removeBullet: (path: string) => string | null;

  /* A block is one job, project, qualification or achievement — the unit the
     hover controls act on. Paths look like `roles.1`. */

  /** Add an empty block after this one. Returns where the caret should go. */
  addBlock: (row: string) => string | null;
  removeBlock: (row: string) => void;
  /** -1 or 1. Moving past either end does nothing. */
  moveBlock: (row: string, by: number) => void;
};

/**
 * One piece of text, editable or not.
 *
 * The non-editing branch renders a bare string, so the printed page and the
 * gallery thumbnails carry no extra DOM at all. The editing branch wraps it in
 * an inline span, so the extracted text is unchanged: `<span>Title</span> —
 * <span>Company</span>` comes out of a PDF as "Title — Company", exactly as
 * the unwrapped version does.
 *
 * Committing on blur rather than on every keystroke is what keeps a
 * contentEditable and React from fighting: no state changes while the caret is
 * in the node, so React never re-renders underneath it and the caret never
 * jumps to the start of the line.
 */
function T({
  path,
  value,
  edit,
  placeholder,
  bullet,
  styles,
}: {
  path: string;
  value: string | null | undefined;
  edit?: Edit;
  placeholder?: string;
  /** Bullets get Enter and Backspace behaviour; ordinary fields do not. */
  bullet?: boolean;
  styles?: Presentation;
}) {
  const text = value ?? "";
  const css = styleToCss(styles?.fields[path]);

  // Read-only still wears the styling. A shared link and a printed PDF have to
  // look like the thing that was edited, or the editor is lying.
  if (!edit) return css ? <span style={css}>{text}</span> : <>{text}</>;

  return (
    <span
      className="rd-edit"
      style={css}
      onFocus={() => edit.select?.(path)}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-path={path}
      data-placeholder={placeholder ?? ""}
      onBlur={(e) => edit.set(path, e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => {
        const node = e.currentTarget;
        const current = node.textContent ?? "";

        if (e.key === "Escape") {
          node.textContent = text;
          node.blur();
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();

          // In a bullet, Enter is what fingers already expect: end this line,
          // start the next. Anywhere else a newline would be a line break
          // inside a field, which a parser reads as a new record.
          if (bullet) {
            edit.set(path, current);
            const next = edit.splitBullet(path);
            if (next) focusLater(next);
            return;
          }

          node.blur();
          return;
        }

        // Backspace at the start of an empty bullet removes it, the way every
        // list in every editor behaves. Only when empty: deleting a line
        // somebody has written, because the caret happened to be at the front
        // of it, is how work disappears silently.
        if (e.key === "Backspace" && bullet && current.trim() === "") {
          e.preventDefault();
          const previous = edit.removeBullet(path);
          if (previous) focusLater(previous, "end");
        }
      }}
      // Plain text only. Pasting from a job description otherwise brings its
      // fonts, colours and links into the document.
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    >
      {text}
    </span>
  );
}

/**
 * Put the caret in a field that does not exist yet.
 *
 * The state change that adds the bullet has not rendered when the keystroke is
 * handled, so the node cannot be focused now. Waiting a frame is the smallest
 * thing that works without threading a ref through every level of the
 * document; `data-path` is already on the node, which is what makes it
 * findable at all.
 */
function focusLater(path: string, at: "start" | "end" = "start") {
  requestAnimationFrame(() => {
    const node = document.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
    if (!node) return;
    node.focus();

    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(at === "start");
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
}

/* --------------------------------------------------------------- sections */

/**
 * The controls that appear when you hover a block.
 *
 * Rendered by the document rather than floated over it by the editor, for the
 * same reason the editable fields are: one copy of the structure. Anchoring an
 * overlay to a block means measuring the block, and a measurement is a second
 * description of the layout that can disagree with the first.
 *
 * Every label is CSS `content`, never a text node. A `<button>Delete</button>`
 * between a job title and its dates puts the word "Delete" into the
 * document's text, and text is what a parser extracts and what somebody
 * copies. The accessible name comes from `aria-label`, which screen readers
 * read and text extraction does not.
 */
function BlockTools({ row, edit }: { row: string; edit?: Edit }) {
  if (!edit) return null;
  return (
    <span className="rd-tools" contentEditable={false}>
      <button
        type="button"
        className="rd-tool rd-tool-up"
        aria-label="Move up"
        onClick={() => edit.moveBlock(row, -1)}
      />
      <button
        type="button"
        className="rd-tool rd-tool-down"
        aria-label="Move down"
        onClick={() => edit.moveBlock(row, 1)}
      />
      <button
        type="button"
        className="rd-tool rd-tool-add"
        aria-label="Add one below"
        onClick={() => {
          const next = edit.addBlock(row);
          if (next) focusLater(next);
        }}
      />
      <button
        type="button"
        className="rd-tool rd-tool-delete"
        aria-label="Delete this"
        onClick={() => edit.removeBlock(row)}
      />
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rd-section">
      {/* A heading has to look like a heading to a parser: short, plain, and
          alone on its line. Small caps via CSS would keep the letters
          lowercase in the text layer, so the capitals are real. */}
      <h2 className="rd-h2">{title}</h2>
      {children}
    </section>
  );
}

function Joined({
  parts,
  edit,
  separator,
  stack,
  styles,
}: {
  parts: { path: string; value: string | null | undefined; placeholder?: string }[];
  edit?: Edit;
  separator: string;
  /** One per line rather than one line, which is what a narrow sidebar needs. */
  stack?: boolean;
  styles?: Presentation;
}) {
  const shown = edit ? parts : parts.filter((p) => p.value?.trim());

  if (stack) {
    return (
      <>
        {shown.map((p) => (
          <span key={p.path} className="rd-stacked">
            <T styles={styles} path={p.path} value={p.value} edit={edit} placeholder={p.placeholder} />
          </span>
        ))}
      </>
    );
  }

  return (
    <>
      {shown.map((p, i) => (
        <span key={p.path}>
          {/* The separator sits outside the editable regions so it cannot be
              backspaced away, and an empty field takes its separator with it
              rather than leaving a dangling middot on the printed page. */}
          {i > 0 && <span className="rd-sep">{separator}</span>}
          <T styles={styles} path={p.path} value={p.value} edit={edit} placeholder={p.placeholder} />
        </span>
      ))}
    </>
  );
}

type Ctx = { content: DraftContent; edit?: Edit; stack?: boolean; styles?: Presentation };

/**
 * The rows to draw, with one empty one when the list is empty and somebody is
 * editing.
 *
 * Without this an empty EXPERIENCE section is a heading with nothing under it
 * and no way in — the "Add a job" buttons that used to sit beside the document
 * are gone, and a block's own controls cannot appear on a block that does not
 * exist. A phantom row solves it with no extra state: it renders the
 * placeholders, it carries the same hover controls as a real one, and the
 * moment somebody types, `write()` creates the object the path points at. The
 * document is unchanged until then, so a section nobody fills in stays empty
 * rather than acquiring a blank job.
 */
function rows<T>(list: T[] | null | undefined, edit: Edit | undefined, blank: T): T[] {
  const real = list ?? [];
  if (real.length || !edit) return real;
  return [blank];
}

const BLANK_ROLE = { title: null, company: null, start: null, end: null, is_current: false, highlights: [""] };
const BLANK_PROJECT = { name: null, link: null, description: null, highlights: [""] };
const BLANK_EDUCATION = { degree: null, institution: null, year: null };

/** Every section, keyed, so a layout can arrange them without knowing them. */
function renderSection(key: SectionKey, { content, edit, stack, styles }: Ctx) {
  const some = (n: number | undefined) => (n ?? 0) > 0 || Boolean(edit);

  switch (key) {
    case "summary":
      return content.summary || edit ? (
        <Section key={key} title="SUMMARY">
          <p className="rd-body">
            <T
              styles={styles}
              path="summary"
              value={content.summary}
              edit={edit}
              placeholder="Two or three lines on what you do and what you are after."
            />
          </p>
        </Section>
      ) : null;

    case "experience":
      return some(content.roles?.length) ? (
        <Section key={key} title="EXPERIENCE">
          {rows(content.roles, edit, BLANK_ROLE).map((r, i) => {
            const when = [r.start, r.is_current ? "Present" : r.end].filter(Boolean).join(" – ");
            return (
              <div key={i} className="rd-role" data-row={`roles.${i}`}>
                <BlockTools row={`roles.${i}`} edit={edit} />
                {/* Title and company on one line. A company alone on its own
                    line is short and capitalised, and gets mistaken for a
                    heading — which is how a whole job disappears. */}
                <p className="rd-role-line">
                  <Joined
                    styles={styles}
                    parts={[
                      { path: `roles.${i}.title`, value: r.title, placeholder: "Job title" },
                      { path: `roles.${i}.company`, value: r.company, placeholder: "Company" },
                    ]}
                    edit={edit}
                    separator=" — "
                  />
                </p>
                {(when || edit) && (
                  <p className="rd-dates">
                    <Joined
                      styles={styles}
                      parts={[
                        { path: `roles.${i}.start`, value: r.start, placeholder: "Jan 2023" },
                        {
                          path: `roles.${i}.end`,
                          value: r.is_current ? "Present" : r.end,
                          placeholder: "Present",
                        },
                      ]}
                      edit={edit}
                      separator=" – "
                    />
                  </p>
                )}
                {(r.highlights ?? [])
                  .filter((h) => edit || h?.trim())
                  .map((h, j) => (
                    // The bullet is text, in the same paragraph as the
                    // sentence, so the extracted line reads "• Built…". A CSS
                    // list marker is not text and never leaves the PDF.
                    <p key={j} className="rd-bullet">
                      {"• "}
                      <T
                        styles={styles}
                        path={`roles.${i}.highlights.${j}`}
                        value={h?.trim()}
                        edit={edit}
                        bullet
                        placeholder="What you did, with the number if you have one"
                      />
                    </p>
                  ))}
              </div>
            );
          })}
        </Section>
      ) : null;

    case "projects":
      return some(content.projects?.length) ? (
        <Section key={key} title="PROJECTS">
          {rows(content.projects, edit, BLANK_PROJECT).map((p, i) => (
            <div key={i} className="rd-role" data-row={`projects.${i}`}>
              <BlockTools row={`projects.${i}`} edit={edit} />
              <p className="rd-role-line">
                <Joined
                  styles={styles}
                  parts={[
                    { path: `projects.${i}.name`, value: p.name, placeholder: "Project" },
                    { path: `projects.${i}.link`, value: p.link, placeholder: "link" },
                  ]}
                  edit={edit}
                  separator=" — "
                />
              </p>
              {(p.description || edit) && (
                <p className="rd-body">
                  <T
                    styles={styles}
                    path={`projects.${i}.description`}
                    value={p.description}
                    edit={edit}
                    placeholder="One line on what it is"
                  />
                </p>
              )}
              {(p.highlights ?? [])
                .filter((h) => edit || h?.trim())
                .map((h, j) => (
                  <p key={j} className="rd-bullet">
                    {"• "}
                    <T
                      styles={styles}
                      path={`projects.${i}.highlights.${j}`}
                      value={h?.trim()}
                      edit={edit}
                      bullet
                      placeholder="What it does, or what you learned"
                    />
                  </p>
                ))}
            </div>
          ))}
        </Section>
      ) : null;

    case "education":
      return some(content.education?.length) ? (
        <Section key={key} title="EDUCATION">
          {rows(content.education, edit, BLANK_EDUCATION).map((e, i) => (
            <div key={i} className="rd-edu" data-row={`education.${i}`}>
              <BlockTools row={`education.${i}`} edit={edit} />
              <p className="rd-role-line">
                <Joined
                  styles={styles}
                  parts={[
                    { path: `education.${i}.degree`, value: e.degree, placeholder: "Degree" },
                    {
                      path: `education.${i}.institution`,
                      value: e.institution,
                      placeholder: "Institution",
                    },
                  ]}
                  edit={edit}
                  separator=" — "
                  stack={stack}
                />
              </p>
              {(e.year || edit) && (
                <p className="rd-dates">
                  <T styles={styles} path={`education.${i}.year`} value={e.year} edit={edit} placeholder="2021" />
                </p>
              )}
            </div>
          ))}
        </Section>
      ) : null;

    case "skills":
      return some(content.skills?.length) ? (
        <Section key={key} title="SKILLS">
          {/* One comma-separated line, never chips. Chips are boxes, boxes are
              layout, and layout is what a parser loses. In a narrow sidebar
              the same line simply wraps. */}
          <p className="rd-body">
            <T
              styles={styles}
              path="skills"
              value={(content.skills ?? []).join(", ")}
              edit={edit}
              placeholder="Python, Postgres, Django, AWS"
            />
          </p>
        </Section>
      ) : null;

    case "certifications":
      return some(content.certifications?.length) ? (
        <Section key={key} title="CERTIFICATIONS">
          <p className="rd-body">
            <T
              styles={styles}
              path="certifications"
              value={(content.certifications ?? []).join(", ")}
              edit={edit}
              placeholder="AWS Solutions Architect, 2024"
            />
          </p>
        </Section>
      ) : null;

    case "achievements":
      return some(content.achievements?.length) ? (
        <Section key={key} title="ACHIEVEMENTS">
          {rows(content.achievements, edit, "").map((a, i) => (
            <p key={i} className="rd-bullet">
              {"• "}
              <T
                styles={styles}
                path={`achievements.${i}`}
                value={a}
                edit={edit}
                bullet
                placeholder="Something you won, shipped or were picked for"
              />
            </p>
          ))}
        </Section>
      ) : null;
  }
}

/* ---------------------------------------------------------------- headers */

function Name({ content, edit, styles }: Ctx) {
  return (
    <>
      {(content.full_name || edit) && (
        <h1 className="rd-name">
          <T styles={styles} path="full_name" value={content.full_name} edit={edit} placeholder="Your name" />
        </h1>
      )}
      {(content.headline || edit) && (
        <p className="rd-headline">
          <T
            styles={styles}
            path="headline"
            value={content.headline}
            edit={edit}
            placeholder="What you do, in under twelve words"
          />
        </p>
      )}
    </>
  );
}

function contactParts(content: DraftContent) {
  return [
    { path: "email", value: content.email, placeholder: "email" },
    { path: "phone", value: content.phone, placeholder: "phone" },
    ...(content.links ?? []).map((l, i) => ({
      path: `links.${i}.url`,
      value: l.url,
      placeholder: "link",
    })),
    { path: "location", value: content.location, placeholder: "city" },
  ];
}

/**
 * A monogram where a Canva template would put a headshot.
 *
 * There is no photograph in the resume schema, and inventing one here would
 * mean an upload, a crop, storage and a moderation question — none of which
 * this feature needs to answer today. Initials fill the same hole in the
 * composition, cost nothing, and cannot be a picture of the wrong person.
 */
function Monogram({ name, photo }: { name: string | null | undefined; photo?: string | null }) {
  if (photo) {
    // A plain <img> rather than next/image: this is a data URL that is already
    // the right size, and the optimiser would be a round trip to resize
    // something nobody is going to download twice. It also has to survive
    // being printed, where next/image's lazy loading is a liability.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="rd-photo" src={photo} alt="" aria-hidden />;
  }

  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  if (!initials) return null;
  return (
    <span className="rd-monogram" aria-hidden>
      {initials}
    </span>
  );
}

/* --------------------------------------------------------------- the page */

export function ResumeDocument({
  content,
  template,
  edit,
  styles = EMPTY_PRESENTATION,
  photo,
}: {
  content: DraftContent;
  template?: string | null;
  edit?: Edit;
  /** Hand-made overrides on top of the template. */
  styles?: Presentation;
  /** A data URL. Only the layouts with somewhere to put one will use it. */
  photo?: string | null;
}) {
  const chosen = templateById(template);
  const layout: Layout = chosen.layout;
  const { aside, main } = sectionOrder(layout);

  const ctx: Ctx = { content, edit, styles };
  const asideCtx: Ctx = { content, edit, stack: true, styles };

  /**
   * A hidden section stays hidden while editing too.
   *
   * The alternative — showing it greyed out so it can be switched back on —
   * puts a section somebody deliberately removed back on their page, which is
   * the opposite of what they asked for. Getting it back is the toolbar's job,
   * where the list of what is off can be seen all at once.
   */
  const body = (keys: SectionKey[], c: Ctx) =>
    keys.filter((k) => !styles.hidden.includes(k)).map((k) => renderSection(k, c));
  const contact = (stack?: boolean) => (
    <p className="rd-contact">
      <Joined styles={styles} parts={contactParts(content)} edit={edit} separator=" · " stack={stack} />
    </p>
  );

  return (
    <article
      className={`rd-page rd-l-${layout}${edit ? " rd-editing" : ""}`}
      style={{ width: A4.width, ...themeVars(chosen.theme) }}
    >
      <style>{SHEET}</style>
      {/* Loaded whenever the document renders, not only when a web font is in
          use: a print that fires before the font arrives silently comes out in
          the fallback, and there is no second chance to notice. React hoists
          this into the head and de-duplicates it across the ten documents a
          gallery page renders. */}
      <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />

      {layout === "column" && (
        <div className="rd-pad">
          <header className="rd-head">
            <Name {...ctx} />
            {contact()}
          </header>
          {body(main, ctx)}
        </div>
      )}

      {layout === "band" && (
        <>
          <header className="rd-band">
            <div className="rd-band-text">
              <Name {...ctx} />
              {contact()}
            </div>
            <Monogram name={content.full_name} photo={photo} />
          </header>
          <div className="rd-pad">{body(main, ctx)}</div>
        </>
      )}

      {layout === "sidebar" && (
        <div className="rd-cols">
          <aside className="rd-aside">
            <div className="rd-aside-head">
              <Monogram name={content.full_name} photo={photo} />
              <Name {...ctx} />
            </div>
            <section className="rd-section">
              <h2 className="rd-h2">CONTACT</h2>
              {contact(true)}
            </section>
            {body(aside, asideCtx)}
          </aside>
          <div className="rd-main">{body(main, ctx)}</div>
        </div>
      )}

      {layout === "split" && (
        <>
          <header className="rd-split-head">
            <Name {...ctx} />
            {contact()}
          </header>
          <div className="rd-cols">
            <aside className="rd-aside">{body(aside, asideCtx)}</aside>
            <div className="rd-main">{body(main, ctx)}</div>
          </div>
        </>
      )}
    </article>
  );
}

/**
 * Scoped to `.rd-`, and deliberately not Tailwind.
 *
 * This is the one place in the app whose measurements are in millimetres and
 * whose output is a printed page rather than a screen. Keeping it as plain CSS
 * next to the markup means the document can be lifted out whole — into a
 * headless print worker, or a real PDF writer later — without dragging a
 * utility framework and a build step behind it.
 */
const SHEET = `
.rd-page {
  box-sizing: border-box;
  /* A flex column so the two-column body can be told to fill what is left
     under the header. Without it a sidebar stops where its text stops, which
     reads as a broken box rather than as a column. */
  display: flex;
  flex-direction: column;
  min-height: 297mm;
  background: #fff;
  color: #000;
  /* Every variable has a fallback, so a template that sets nothing still
     renders as the plain black-and-white column. */
  font-family: var(--rd-font, Helvetica, Arial, "Liberation Sans", sans-serif);
  font-size: var(--rd-size, 10pt);
  line-height: var(--rd-lead, 1.42);
}
.rd-pad { padding: 15mm 17mm; flex: 1; }

/* ------------------------------------------------------------- the header */

.rd-head { text-align: var(--rd-align, left); }
.rd-name {
  margin: 0;
  font-size: var(--rd-name-size, 19pt);
  font-weight: var(--rd-name-weight, 700);
  letter-spacing: var(--rd-name-tracking, -0.01em);
  text-transform: var(--rd-name-case, none);
  line-height: 1.12;
}
.rd-headline { margin: 1.5mm 0 0; font-size: 11pt; font-weight: 400; }
.rd-contact {
  margin: 2mm 0 0;
  font-size: 8.5pt;
  color: var(--rd-muted, #333);
  word-break: break-word;
}
.rd-stacked { display: block; }
.rd-stacked + .rd-stacked { margin-top: 1mm; }

/* --------------------------------------------------------------- sections */

.rd-section { margin-top: var(--rd-section-gap, 6mm); }
.rd-section:first-child { margin-top: 0; }
.rd-h2 {
  margin: 0 0 var(--rd-h2-gap, 2mm);
  padding-bottom: 1mm;
  border-bottom: var(--rd-h2-rule, 0.4pt solid #000);
  font-size: var(--rd-h2-size, 9pt);
  font-weight: var(--rd-h2-weight, 700);
  letter-spacing: var(--rd-h2-tracking, 0.08em);
  color: var(--rd-h2-color, #000);
}
.rd-body { margin: 0; }
.rd-role { margin-top: var(--rd-role-gap, 3.5mm); }
.rd-role:first-of-type { margin-top: 0; }
.rd-edu + .rd-edu { margin-top: 2.5mm; }
.rd-role-line { margin: 0; font-weight: 700; }
.rd-dates { margin: 0.5mm 0 1mm; font-size: 8.5pt; color: var(--rd-muted, #333); }
.rd-bullet { margin: 0 0 0.8mm; padding-left: 4mm; text-indent: -4mm; }

/* ------------------------------------------------------------ header band */

.rd-band {
  display: flex;
  align-items: center;
  gap: 8mm;
  padding: 12mm 17mm;
  background: var(--rd-accent, #1e3a5f);
  color: var(--rd-on-accent, #fff);
}
.rd-band-text { flex: 1; min-width: 0; }
.rd-band .rd-contact { color: rgba(255, 255, 255, 0.86); }
.rd-photo {
  width: 22mm;
  height: 22mm;
  flex: none;
  border-radius: 50%;
  object-fit: cover;
  border: 0.6pt solid rgba(255, 255, 255, 0.55);
}
.rd-l-sidebar .rd-aside-head .rd-photo { margin-bottom: 4mm; border-color: currentColor; }
.rd-monogram {
  display: grid;
  place-items: center;
  width: 22mm;
  height: 22mm;
  flex: none;
  border-radius: 50%;
  border: 0.6pt solid rgba(255, 255, 255, 0.55);
  font-size: 15pt;
  font-weight: 700;
  letter-spacing: 0.04em;
}

/* ---------------------------------------------------------------- columns */

.rd-cols { display: flex; align-items: stretch; flex: 1; min-height: 0; }
.rd-aside { width: var(--rd-aside-width, 58mm); flex: none; padding: 12mm 8mm; }
.rd-main { flex: 1; min-width: 0; padding: 12mm 12mm 12mm 10mm; }

/* A sidebar is a filled column; the two-column split is a washed one. Both
   read the same way to a parser — left column first — which is the part that
   costs points and the part a score has to say out loud. */
.rd-l-sidebar .rd-aside {
  background: var(--rd-wash, #2f3640);
  color: var(--rd-aside-text, var(--rd-on-accent, #fff));
}
.rd-l-sidebar .rd-aside .rd-h2 {
  color: var(--rd-aside-heading, var(--rd-on-accent, #fff));
  border-bottom-color: currentColor;
  opacity: 1;
}
/* Quieter than the body, whichever way round the column is, without needing
   a second colour token per template. */
.rd-l-sidebar .rd-aside .rd-contact,
.rd-l-sidebar .rd-aside .rd-dates { color: inherit; opacity: 0.78; }
.rd-l-sidebar .rd-aside-head { margin-bottom: 7mm; }
.rd-l-sidebar .rd-aside-head .rd-monogram { margin-bottom: 4mm; border-color: currentColor; opacity: 0.85; }
.rd-l-sidebar .rd-aside .rd-name { font-size: calc(var(--rd-name-size, 20pt) * 0.8); }
.rd-l-sidebar .rd-aside .rd-headline { font-size: 9pt; opacity: 0.85; }

.rd-l-split .rd-split-head {
  padding: 13mm 14mm 6mm;
  border-bottom: 1.2pt solid var(--rd-accent, #14706b);
}
.rd-l-split .rd-split-head .rd-name { color: var(--rd-accent, #14706b); }
.rd-l-split .rd-aside { background: var(--rd-wash, #e7f1f0); padding: 10mm 8mm; }

/* ------------------------------------------------------------ editing only

   None of this reaches the printed page. The document must look identical
   whether or not somebody is typing into it — an editor that shows you
   something other than what prints is a preview with extra steps. */

.rd-editing .rd-edit {
  outline: none;
  border-radius: 2px;
  /* Box-shadow rather than padding or border, so nothing shifts on hover —
     text that moves under the cursor is maddening to click. */
  box-shadow: 0 0 0 3px transparent;
  transition: box-shadow 90ms ease, background-color 90ms ease;
  cursor: text;
}
.rd-editing .rd-edit:hover { box-shadow: 0 0 0 3px rgba(0,0,0,0.05); background: rgba(0,0,0,0.05); }
.rd-editing .rd-edit:focus { box-shadow: 0 0 0 3px rgba(37,99,235,0.2); background: rgba(37,99,235,0.09); }
.rd-editing.rd-l-sidebar .rd-aside .rd-edit:hover {
  box-shadow: 0 0 0 3px rgba(255,255,255,0.16);
  background: rgba(255,255,255,0.16);
}

/* An empty field is invisible and therefore unclickable, so it says what it is
   for. Generated content, never a text node — it must not be picked up as part
   of the document. */
.rd-editing .rd-edit:empty::before {
  content: attr(data-placeholder);
  color: #9aa0a6;
  font-weight: 400;
}
.rd-editing.rd-l-sidebar .rd-aside .rd-edit:empty::before { color: rgba(255,255,255,0.55); }
.rd-editing .rd-sep { color: #c0c4c8; }

/* Block controls. Out of the flow entirely and revealed on hover, so a page
   being edited has exactly the measurements of a page being printed. */
.rd-editing .rd-role, .rd-editing .rd-edu { position: relative; }
.rd-tools {
  position: absolute;
  top: -3mm;
  right: -2mm;
  z-index: 2;
  display: flex;
  gap: 3px;
  padding: 2px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 4px 14px -4px rgba(0,0,0,.3);
  opacity: 0;
  pointer-events: none;
  transition: opacity 100ms ease;
}
.rd-role:hover > .rd-tools, .rd-edu:hover > .rd-tools, .rd-tools:focus-within {
  opacity: 1;
  pointer-events: auto;
}
.rd-tool {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #52525b;
  font-family: Helvetica, Arial, sans-serif;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.rd-tool:hover { background: #f4f4f5; color: #000; }
.rd-tool-delete:hover { background: #fee2e2; color: #b91c1c; }
/* Labels as generated content, never as text nodes — see BlockTools above. */
.rd-tool-up::before { content: "\\2191"; }
.rd-tool-down::before { content: "\\2193"; }
.rd-tool-add::before { content: "+"; font-size: 15px; }
.rd-tool-delete::before { content: "\\00d7"; font-size: 15px; }

/* Where the paper ends. A resume that has quietly become two pages is worth
   knowing about before an employer finds out, and there is nowhere else on
   the screen that could say so. */
.rd-editing { position: relative; }
.rd-editing::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 297mm;
  border-top: 1px dashed rgba(0,0,0,.28);
  pointer-events: none;
}

@media print {
  .rd-page { width: auto; min-height: 0; box-shadow: none; }
  .rd-cols { min-height: 0; }
  .rd-role, .rd-edu { break-inside: avoid; }
  .rd-h2 { break-after: avoid; }
  .rd-edit { box-shadow: none !important; background: none !important; }
  .rd-edit:empty::before { content: "" !important; }
  .rd-tools { display: none !important; }
  .rd-editing::after { display: none !important; }
  /* Fills and washes have to be asked for, or a printer drops them and a
     sidebar template comes out as white text on white paper. */
  .rd-band, .rd-aside, .rd-monogram, .rd-photo {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
