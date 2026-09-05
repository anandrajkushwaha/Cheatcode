import type { Resume as DraftContent } from "@/lib/app/resume-schema";
import { templateById, themeVars } from "@/lib/app/resume-templates";

/**
 * The document itself.
 *
 * Every layout decision here is one an applicant tracking system has to
 * survive, so this is a deliberately boring page: one column, real text, plain
 * headings, no tables, no icons, no photograph, nothing in a header or footer.
 * Twelve of the ATS score's points are for having a single column and fourteen
 * for being readable at all; none of that is advice we have to give somebody,
 * because the template simply does not offer the alternative.
 *
 * The order and shape of what appears here must match `draftToText` in
 * lib/app/resume-draft.ts line for line. That function is what gets scored —
 * it stands in for the text a parser pulls out of the printed PDF — so if the
 * two ever drift, the number on the screen stops describing the file somebody
 * actually sends. Change one, change the other, and run /tmp/drafttest.mts.
 *
 * It renders three ways from one copy of the markup: as a printable page, as a
 * thumbnail in the template gallery, and as the thing you type into. The
 * alternative — an editable twin beside a read-only original — was rejected
 * for the same reason the templates are themes rather than layouts: two copies
 * of this structure would drift, and the drift would show up as a score that
 * describes a document nobody has.
 */

const A4 = { width: "210mm", padding: "15mm 17mm" };

/* ---------------------------------------------------------------- editing */

/**
 * A path into the content tree, as a string: `full_name`, `roles.0.title`,
 * `roles.2.highlights.1`. Strings rather than typed accessors because they
 * also go on the DOM node as `data-path`, which is what makes a click on a
 * word in the page resolvable back to a field.
 */
export type Edit = {
  set: (path: string, value: string) => void;
  /** Append an empty bullet under `roles.0` or `projects.1`. */
  addBullet: (rowPath: string) => void;
  /** Delete a whole job, project, qualification or line. */
  removeRow: (rowPath: string) => void;
};

/**
 * One piece of text, editable or not.
 *
 * The non-editing branch renders a bare string, so the printed page and the
 * gallery thumbnails carry no extra DOM at all. The editing branch wraps it in
 * a span — inline, so the extracted text is unchanged: `<span>Title</span> —
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
}: {
  path: string;
  value: string | null | undefined;
  edit?: Edit;
  placeholder?: string;
}) {
  const text = value ?? "";
  if (!edit) return <>{text}</>;

  return (
    <span
      className="rd-edit"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-path={path}
      data-placeholder={placeholder ?? ""}
      onBlur={(e) => edit.set(path, e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => {
        // Enter ends the edit rather than inserting a line break. A newline
        // inside a resume field is a line a parser reads as a new record.
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.currentTarget.textContent = text;
          e.currentTarget.blur();
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
 * The two controls a row needs, and no more.
 *
 * Rendered by the document rather than floated over it by the editor, for the
 * same reason the editable fields are: one copy of the structure. Anchoring an
 * overlay to a row means measuring the row, and a measurement is a second
 * description of the layout that can disagree with the first.
 *
 * They exist only while editing and are dropped at print — and their labels
 * are CSS `content` rather than text nodes, which is the part that matters.
 * A `<button>Remove</button>` sitting between a job title and its dates puts
 * the word "Remove" into the document's text, and text is what a parser
 * extracts and what somebody copies. The test in /tmp/toolharness caught
 * exactly that; the accessible name comes from `aria-label` instead, which
 * screen readers use and text extraction does not.
 */
function RowTools({
  row,
  edit,
  onAddBullet,
}: {
  row: string;
  edit?: Edit;
  onAddBullet?: boolean;
}) {
  if (!edit) return null;
  return (
    <span className="rd-tools" contentEditable={false}>
      {onAddBullet && (
        <button
          type="button"
          className="rd-tool rd-tool-add"
          aria-label="Add a line"
          onClick={() => edit.addBullet(row)}
        />
      )}
      <button
        type="button"
        className="rd-tool rd-tool-remove"
        aria-label="Remove this"
        onClick={() => edit.removeRow(row)}
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

/**
 * A section that is empty and has nothing to show — except while editing,
 * when it has to be reachable or there is no way to fill it in.
 */
const has = (n: number | undefined, edit?: Edit) => (n ?? 0) > 0 || Boolean(edit);

/**
 * @param template Which theme to paint it in. The markup below does not change
 *   with it — see lib/app/resume-templates.ts for why that is the whole point.
 * @param edit When passed, every piece of text becomes editable in place. The
 *   document stays the document; it does not turn into a form beside a preview.
 */
export function ResumeDocument({
  content,
  template,
  edit,
}: {
  content: DraftContent;
  template?: string | null;
  edit?: Edit;
}) {
  const links = content.links ?? [];

  return (
    <article
      className={`rd-page${edit ? " rd-editing" : ""}`}
      style={{ width: A4.width, padding: A4.padding, ...themeVars(templateById(template).theme) }}
    >
      <style>{CSS}</style>

      <header>
        {(content.full_name || edit) && (
          <h1 className="rd-name">
            <T path="full_name" value={content.full_name} edit={edit} placeholder="Your name" />
          </h1>
        )}
        {(content.headline || edit) && (
          <p className="rd-headline">
            <T
              path="headline"
              value={content.headline}
              edit={edit}
              placeholder="What you do, in under twelve words"
            />
          </p>
        )}

        {/* One line, separated by middots. Each field is its own region so a
            click lands on the phone number rather than on the whole line. */}
        <p className="rd-contact">
          <Joined
            parts={[
              { path: "email", value: content.email, placeholder: "email" },
              { path: "phone", value: content.phone, placeholder: "phone" },
              ...links.map((l, i) => ({
                path: `links.${i}.url`,
                value: l.url,
                placeholder: "link",
              })),
              { path: "location", value: content.location, placeholder: "city" },
            ]}
            edit={edit}
            separator=" · "
          />
        </p>
      </header>

      {(content.summary || edit) && (
        <Section title="SUMMARY">
          <p className="rd-body">
            <T
              path="summary"
              value={content.summary}
              edit={edit}
              placeholder="Two or three lines on what you do and what you are after."
            />
          </p>
        </Section>
      )}

      {has(content.roles?.length, edit) && (
        <Section title="EXPERIENCE">
          {(content.roles ?? []).map((r, i) => {
            // Title and company on one line. A company alone on its own line
            // is short and capitalised, and gets mistaken for a heading —
            // which is how a whole job disappears from a parsed resume.
            const when = [r.start, r.is_current ? "Present" : r.end].filter(Boolean).join(" – ");

            return (
              <div key={i} className="rd-role" data-row={`roles.${i}`}>
                <RowTools row={`roles.${i}`} edit={edit} onAddBullet />
                <p className="rd-role-line">
                  <Joined
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
                    // list marker is not text and does not come out of the PDF.
                    <p key={j} className="rd-bullet">
                      {"• "}
                      <T
                        path={`roles.${i}.highlights.${j}`}
                        value={h?.trim()}
                        edit={edit}
                        placeholder="What you did, with the number if you have one"
                      />
                    </p>
                  ))}
              </div>
            );
          })}
        </Section>
      )}

      {has(content.projects?.length, edit) && (
        <Section title="PROJECTS">
          {(content.projects ?? []).map((p, i) => (
            <div key={i} className="rd-role" data-row={`projects.${i}`}>
              <RowTools row={`projects.${i}`} edit={edit} onAddBullet />
              <p className="rd-role-line">
                <Joined
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
                      path={`projects.${i}.highlights.${j}`}
                      value={h?.trim()}
                      edit={edit}
                      placeholder="What it does, or what you learned"
                    />
                  </p>
                ))}
            </div>
          ))}
        </Section>
      )}

      {has(content.education?.length, edit) && (
        <Section title="EDUCATION">
          {(content.education ?? []).map((e, i) => (
            <div key={i} className="rd-edu" data-row={`education.${i}`}>
              <RowTools row={`education.${i}`} edit={edit} />
              <p className="rd-role-line">
                <Joined
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
                />
              </p>
              {(e.year || edit) && (
                <p className="rd-dates">
                  <T
                    path={`education.${i}.year`}
                    value={e.year}
                    edit={edit}
                    placeholder="2021"
                  />
                </p>
              )}
            </div>
          ))}
        </Section>
      )}

      {has(content.skills?.length, edit) && (
        <Section title="SKILLS">
          {/* One comma-separated line, not chips. Chips are boxes, boxes are
              layout, and layout is what a parser loses. Edited as the same
              single line, and split back into a list on the way in — which is
              also how somebody naturally types a list of skills. */}
          <p className="rd-body">
            <T
              path="skills"
              value={(content.skills ?? []).join(", ")}
              edit={edit}
              placeholder="Python, Postgres, Django, AWS"
            />
          </p>
        </Section>
      )}

      {has(content.certifications?.length, edit) && (
        <Section title="CERTIFICATIONS">
          <p className="rd-body">
            <T
              path="certifications"
              value={(content.certifications ?? []).join(", ")}
              edit={edit}
              placeholder="AWS Solutions Architect, 2024"
            />
          </p>
        </Section>
      )}

      {has(content.achievements?.length, edit) && (
        <Section title="ACHIEVEMENTS">
          {(content.achievements ?? []).map((a, i) => (
            <p key={i} className="rd-bullet">
              {"• "}
              <T
                path={`achievements.${i}`}
                value={a}
                edit={edit}
                placeholder="Something you won, shipped or were picked for"
              />
            </p>
          ))}
        </Section>
      )}
    </article>
  );
}

/**
 * Several fields on one line with a separator between them.
 *
 * The separator sits outside the editable regions, so it cannot be deleted by
 * somebody backspacing at the start of a field — and an empty field drops its
 * separator with it, so a missing phone number does not leave a dangling
 * middot in the printed page.
 */
function Joined({
  parts,
  edit,
  separator,
}: {
  parts: { path: string; value: string | null | undefined; placeholder?: string }[];
  edit?: Edit;
  separator: string;
}) {
  const shown = edit ? parts : parts.filter((p) => p.value?.trim());

  return (
    <>
      {shown.map((p, i) => (
        <span key={p.path}>
          {i > 0 && <span className="rd-sep">{separator}</span>}
          <T path={p.path} value={p.value} edit={edit} placeholder={p.placeholder} />
        </span>
      ))}
    </>
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
const CSS = `
.rd-page {
  box-sizing: border-box;
  min-height: 297mm;
  background: #fff;
  color: #000;
  /* Every one of these has a fallback, so a template that sets nothing still
     renders exactly as this page did before templates existed. The defaults
     are Classic, deliberately: an existing draft cannot change appearance
     because a feature was added around it. */
  font-family: var(--rd-font, Helvetica, Arial, "Liberation Sans", sans-serif);
  font-size: var(--rd-size, 10pt);
  line-height: var(--rd-lead, 1.42);
}
.rd-page > header { text-align: var(--rd-align, left); }
.rd-name {
  margin: 0;
  font-size: var(--rd-name-size, 19pt);
  font-weight: var(--rd-name-weight, 700);
  letter-spacing: var(--rd-name-tracking, -0.01em);
  color: var(--rd-name-color, #000);
}
.rd-headline {
  margin: 1.5mm 0 0;
  font-size: 11pt;
  font-weight: 400;
}
.rd-contact {
  margin: 2mm 0 0;
  font-size: 9pt;
  color: var(--rd-muted, #333);
  word-break: break-word;
}
.rd-section { margin-top: var(--rd-section-gap, 6mm); }
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
.rd-dates { margin: 0.5mm 0 1mm; font-size: 9pt; color: var(--rd-muted, #333); }
.rd-bullet {
  margin: 0 0 0.8mm;
  padding-left: 4mm;
  text-indent: -4mm;
}

/* ------------------------------------------------------------ editing only

   None of this reaches the printed page: it hangs off .rd-editing, which is
   only set when the document is being typed into, and print drops it anyway.
   The document must look identical whether or not somebody is editing it —
   an editor that shows you something other than what prints is not an
   editor, it is a preview with extra steps. */

.rd-editing .rd-edit {
  outline: none;
  border-radius: 2px;
  /* Box-shadow rather than padding or border, so nothing shifts when a field
     is hovered — text that moves under the cursor is maddening to click. */
  box-shadow: 0 0 0 3px transparent;
  transition: box-shadow 90ms ease, background-color 90ms ease;
  cursor: text;
}
.rd-editing .rd-edit:hover { box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05); background: rgba(0,0,0,0.05); }
.rd-editing .rd-edit:focus { box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18); background: rgba(37, 99, 235, 0.08); }

/* An empty field is invisible and therefore unclickable, so it shows what it
   is for instead. Attribute content, not a text node — it must never be
   picked up as part of the document. */
.rd-editing .rd-edit:empty::before {
  content: attr(data-placeholder);
  color: #9aa0a6;
  font-weight: 400;
}
.rd-editing .rd-sep { color: #c0c4c8; }

/* Row controls. Out of the flow entirely and revealed on hover, so a page
   being edited has the same measurements as a page being printed. */
.rd-editing .rd-role, .rd-editing .rd-edu { position: relative; }
.rd-tools {
  position: absolute;
  top: -2mm;
  right: 0;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 90ms ease;
}
.rd-role:hover > .rd-tools, .rd-edu:hover > .rd-tools,
.rd-tools:focus-within { opacity: 1; }
.rd-tool {
  border: 1px solid rgba(0,0,0,0.14);
  border-radius: 999px;
  background: #fff;
  padding: 1px 7px;
  font-family: Helvetica, Arial, sans-serif;
  font-size: 7.5pt;
  line-height: 1.5;
  color: #444;
  cursor: pointer;
}
.rd-tool:hover { border-color: #000; color: #000; }
/* Labels as generated content, never as text nodes — see RowTools above. */
.rd-tool-add::before { content: "+ line"; }
.rd-tool-remove::before { content: "Remove"; }

@media print {
  .rd-page { width: auto; min-height: 0; padding: 0; box-shadow: none; }
  .rd-role, .rd-edu { break-inside: avoid; }
  .rd-h2 { break-after: avoid; }
  .rd-edit { box-shadow: none !important; background: none !important; }
  .rd-edit:empty::before { content: "" !important; }
  .rd-tools { display: none !important; }
}
`;
