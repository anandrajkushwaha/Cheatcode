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
 * showed, with the person's own name and contact details put in place of the
 * sample's. What they have written is never replaced: this only applies when
 * there are no roles, no education, no projects and next to no skills.
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
  const sample = sampleFor(templateId);
  return {
    ...sample,
    full_name: own.full_name || sample.full_name,
    email: own.email || sample.email,
    phone: own.phone || sample.phone,
    location: own.location || sample.location,
    headline: own.headline || sample.headline,
    target_role: own.target_role || sample.target_role,
  };
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
