import type { Resume } from "@/lib/app/resume-schema";
import type { Design } from "@/lib/app/design";
import { sampleFor } from "@/lib/app/design-sample";

/**
 * What a template opens with when there is nothing of the person's to put in it.
 *
 * Picking a template used to fill it with whatever we had — and for anybody
 * who had not uploaded a résumé, that was their name and email. The template
 * opened as a name on an empty page: no sections, no layout, nothing to write
 * over. Every design tool that works (Canva included) does the opposite: the
 * template arrives complete, and you replace its words with yours.
 *
 * So a thin draft is filled with the same sample résumé the gallery card
 * showed, exactly as the card showed it. What they have written is never
 * replaced: this only applies when there are no roles, no education, no
 * projects and next to no skills.
 */
export function isThin(r: Resume): boolean {
  return (
    !r.roles.length &&
    !r.education.length &&
    !r.projects.length &&
    r.skills.length < 3 &&
    !(r.summary && r.summary.trim().length > 40)
  );
}

export function starterContent(own: Resume, templateId: string): Resume {
  if (!isThin(own)) return own;
  // The template's own sample, complete and untouched. An earlier version put
  // the person's name and contact details into it, which read as their résumé
  // mixed with somebody else's jobs — worse than either. The whole document is
  // theirs to write over.
  return sampleFor(templateId);
}

/**
 * How much writing a design holds. A saved design with almost none — a name
 * and a contact line — has nothing in it to lose, so it can be re-seeded.
 */
export function designTextLength(d: Design): number {
  let n = 0;
  for (const p of d.pages) {
    for (const el of p.elements) {
      if (el.type === "text") n += el.text.replace(/<[^>]+>/g, "").trim().length;
    }
  }
  return n;
}
