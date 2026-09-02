import type { Profile, Resume } from "@/lib/app/account";
import { analyseResume, type AtsResult, type ResumeFacts } from "@/lib/tools/ats";
import {
  cleanResume,
  emptyResume,
  resumeIsEmpty,
  type Resume as ResumeContent,
} from "@/lib/app/resume-schema";

/**
 * A resume as data, not as a file.
 *
 * `resumes` records a document that exists somewhere else — its text, its
 * score, what the model read out of it — and is never edited, because
 * re-scoring an upload after we changed it would make the number a fiction.
 * A draft is the other thing: a document we own, that a person edits, that
 * the agent proposes changes to, and that renders to a PDF whose every
 * layout property we chose.
 *
 * Same shape as `resumes.parsed`, deliberately. A draft begins as a copy of
 * it — their roles, their dates, their bullets, already in the boxes. The
 * blank editor is the second door, never the front one.
 */

export type DraftContent = ResumeContent;

/* ------------------------------------------------------------------ seed */

/**
 * Start a draft from what they already gave us.
 *
 * The profile fills only what the resume left empty. Somebody who typed their
 * city into onboarding should not have to type it again because the parser
 * missed it, and the resume wins where both have an answer — it is the
 * document being edited, and the profile is a summary of it.
 */
export function seedFromResume(resume: Resume | null, profile: Profile | null): DraftContent {
  const p = resume?.parsed;
  const base = emptyResume();

  return cleanResume({
    ...base,
    ...(p ?? {}),
    full_name: p?.full_name ?? profile?.full_name ?? null,
    location: p?.location ?? profile?.preferred_cities?.[0] ?? null,
    headline: p?.headline ?? profile?.current_title ?? null,
    years_experience: p?.years_experience ?? profile?.years_experience ?? null,
    target_role: p?.target_role ?? profile?.target_roles?.[0] ?? null,
    skills: p?.skills?.length ? p.skills : (resume?.skills ?? []),
  });
}

/* ------------------------------------------------------------------ text */

/**
 * The draft as the plain text a parser would pull out of the PDF.
 *
 * This is the whole trick behind scoring a draft honestly: rather than
 * inventing a second scorer that reads the JSON, the draft is written out the
 * way our own template lays it out, and then goes through the same
 * `analyseResume` an upload goes through. If those two ever disagree,
 * "79 → 87" is a number we made up.
 *
 * The shapes here are not arbitrary — each one is what the scorer looks for:
 * headings short enough and plain enough to be recognised as headings, the
 * contact line inside the first few lines, dates in a range it can read, and
 * bullets that start with a bullet character.
 */
export function draftToText(c: DraftContent): string {
  const out: string[] = [];

  if (c.full_name) out.push(c.full_name);
  if (c.headline) out.push(c.headline);

  // Everything a parser looks for, on one plain line near the very top. The
  // "contact near the top" check measures where the email sits as a fraction
  // of the whole document, so this cannot drift down the page.
  const contact = [
    c.email,
    c.phone,
    ...(c.links ?? []).map((l) => l.url).filter(Boolean),
    c.location,
  ].filter(Boolean);
  if (contact.length) out.push(contact.join(" · "));

  if (c.summary) {
    out.push("", "SUMMARY", c.summary);
  }

  if (c.roles?.length) {
    out.push("", "EXPERIENCE");
    for (const r of c.roles) {
      // Title and company on one line: a company alone on its own line is
      // short, capitalised and would be mistaken for a section heading.
      const line = [r.title, r.company].filter(Boolean).join(" — ");
      if (line) out.push("", line);

      const when = [r.start, r.is_current ? "Present" : r.end].filter(Boolean).join(" – ");
      if (when) out.push(when);

      for (const h of r.highlights ?? []) {
        if (h?.trim()) out.push(`• ${h.trim()}`);
      }
    }
  }

  // Projects sit between experience and education: for a fresher they are the
  // strongest thing on the page, and putting education first would lead with
  // the weakest section a reader looks at.
  if (c.projects?.length) {
    out.push("", "PROJECTS");
    for (const p of c.projects) {
      const line = [p.name, p.link].filter(Boolean).join(" — ");
      if (line) out.push("", line);
      if (p.description) out.push(p.description);
      for (const h of p.highlights ?? []) {
        if (h?.trim()) out.push(`• ${h.trim()}`);
      }
    }
  }

  if (c.education?.length) {
    out.push("", "EDUCATION");
    for (const e of c.education) {
      const line = [e.degree, e.institution].filter(Boolean).join(" — ");
      if (line) out.push(line);
      if (e.year) out.push(String(e.year));
    }
  }

  if (c.skills?.length) {
    out.push("", "SKILLS", c.skills.join(", "));
  }

  if (c.certifications?.length) {
    out.push("", "CERTIFICATIONS", c.certifications.join(", "));
  }

  // One per line rather than comma-joined: an achievement is a sentence, and
  // three of them run together read as one long one.
  if (c.achievements?.length) {
    out.push("", "ACHIEVEMENTS");
    for (const a of c.achievements) out.push(`• ${a}`);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ----------------------------------------------------------------- score */

/** A4 at our margins and body size, near enough for a length estimate. */
const CHARS_PER_LINE = 95;
const LINES_PER_PAGE = 48;

/**
 * The draft, measured as if it had already been printed.
 *
 * `multiColumnPages` is zero and that is not a favour to ourselves — the
 * template genuinely has one column, which is the entire reason a generated
 * document banks the 26 points of machine readability without anybody being
 * advised into it.
 */
export function draftFacts(c: DraftContent): ResumeFacts {
  const text = draftToText(c);

  const visualLines = text
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0);

  const pages = Math.max(1, Math.ceil(visualLines / LINES_PER_PAGE));
  const chars = text.replace(/\s/g, "").length;

  return {
    text,
    fileType: "pdf",
    pages,
    charsPerPage: Array.from({ length: pages }, () => Math.round(chars / pages)),
    multiColumnPages: 0,
  };
}

/** The same score an upload gets, from the same function. */
export function scoreDraft(c: DraftContent): AtsResult {
  return analyseResume(draftFacts(c));
}

/* ---------------------------------------------------------------- tidying */

/**
 * What comes back from a browser is not to be trusted, and what comes back
 * from a model is to be trusted even less.
 *
 * One line now. This used to be ninety, duplicating the parser's cleaner with
 * slightly different limits — which is how the two of them came to disagree
 * about a graduation year typed into the years-of-experience box: one clamped
 * it to fifty years, the other dropped it. There is one cleaner now, in
 * resume-schema.ts, and this is the name the builder calls it by.
 */
export const cleanDraft = cleanResume;

/** Is there enough here to render a document somebody would send? */
export const draftIsEmpty = resumeIsEmpty;
