import type { DraftContent } from "@/lib/app/resume-draft";

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
 */

const A4 = { width: "210mm", padding: "15mm 17mm" };

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

export function ResumeDocument({ content }: { content: DraftContent }) {
  const contact = [
    content.email,
    content.phone,
    ...(content.links ?? []).map((l) => l.url).filter(Boolean),
    content.location,
  ].filter(Boolean) as string[];

  return (
    <article className="rd-page" style={{ width: A4.width, padding: A4.padding }}>
      <style>{CSS}</style>

      <header>
        {content.full_name && <h1 className="rd-name">{content.full_name}</h1>}
        {content.headline && <p className="rd-headline">{content.headline}</p>}
        {contact.length > 0 && <p className="rd-contact">{contact.join(" · ")}</p>}
      </header>

      {content.summary && (
        <Section title="SUMMARY">
          <p className="rd-body">{content.summary}</p>
        </Section>
      )}

      {(content.roles?.length ?? 0) > 0 && (
        <Section title="EXPERIENCE">
          {content.roles!.map((r, i) => {
            // Title and company on one line. A company alone on its own line
            // is short and capitalised, and gets mistaken for a heading —
            // which is how a whole job disappears from a parsed resume.
            const line = [r.title, r.company].filter(Boolean).join(" — ");
            const when = [r.start, r.is_current ? "Present" : r.end].filter(Boolean).join(" – ");

            return (
              <div key={i} className="rd-role">
                {line && <p className="rd-role-line">{line}</p>}
                {when && <p className="rd-dates">{when}</p>}
                {(r.highlights ?? [])
                  .filter((h) => h?.trim())
                  .map((h, j) => (
                    // The bullet is text, in the same node as the sentence, so
                    // the extracted line reads "• Built…". A CSS list marker
                    // is not text and does not come out of the PDF.
                    <p key={j} className="rd-bullet">{`• ${h.trim()}`}</p>
                  ))}
              </div>
            );
          })}
        </Section>
      )}

      {(content.education?.length ?? 0) > 0 && (
        <Section title="EDUCATION">
          {content.education!.map((e, i) => (
            <div key={i} className="rd-edu">
              <p className="rd-role-line">{[e.degree, e.institution].filter(Boolean).join(" — ")}</p>
              {e.year && <p className="rd-dates">{e.year}</p>}
            </div>
          ))}
        </Section>
      )}

      {(content.skills?.length ?? 0) > 0 && (
        <Section title="SKILLS">
          {/* One comma-separated line, not chips. Chips are boxes, boxes are
              layout, and layout is what a parser loses. */}
          <p className="rd-body">{content.skills!.join(", ")}</p>
        </Section>
      )}

      {(content.certifications?.length ?? 0) > 0 && (
        <Section title="CERTIFICATIONS">
          <p className="rd-body">{content.certifications!.join(", ")}</p>
        </Section>
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
const CSS = `
.rd-page {
  box-sizing: border-box;
  min-height: 297mm;
  background: #fff;
  color: #000;
  /* Core-14 PDF fonts. Anything more interesting risks being substituted at
     print time, and a substituted font can reflow a one-page resume onto two. */
  font-family: Helvetica, Arial, "Liberation Sans", sans-serif;
  font-size: 10pt;
  line-height: 1.42;
}
.rd-name {
  margin: 0;
  font-size: 19pt;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.rd-headline {
  margin: 1.5mm 0 0;
  font-size: 11pt;
  font-weight: 400;
}
.rd-contact {
  margin: 2mm 0 0;
  font-size: 9pt;
  color: #333;
  word-break: break-word;
}
.rd-section { margin-top: 6mm; }
.rd-h2 {
  margin: 0 0 2mm;
  padding-bottom: 1mm;
  border-bottom: 0.4pt solid #000;
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.rd-body { margin: 0; }
.rd-role { margin-top: 3.5mm; }
.rd-role:first-of-type { margin-top: 0; }
.rd-edu + .rd-edu { margin-top: 2.5mm; }
.rd-role-line { margin: 0; font-weight: 700; }
.rd-dates { margin: 0.5mm 0 1mm; font-size: 9pt; color: #333; }
.rd-bullet {
  margin: 0 0 0.8mm;
  padding-left: 4mm;
  text-indent: -4mm;
}

/* Nothing may break across a page in a way that orphans a job title from its
   bullets — a role split over a page boundary reads as two half-jobs. */
@media print {
  .rd-page { width: auto; min-height: 0; padding: 0; box-shadow: none; }
  .rd-role, .rd-edu { break-inside: avoid; }
  .rd-h2 { break-after: avoid; }
}
`;
