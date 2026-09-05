import type { Profile, Resume } from "@/lib/app/account";
import { analyseResume, type AtsResult, type ResumeFacts } from "@/lib/tools/ats";
import {
  sectionOrder,
  templateById,
  type SectionKey,
} from "@/lib/app/resume-templates";
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
export function draftToText(c: DraftContent, template?: string | null): string {
  const { layout } = templateById(template);
  const { aside, main } = sectionOrder(layout);
  const out: string[] = [];

  if (c.full_name) out.push(c.full_name);
  if (c.headline) out.push(c.headline);

  const contact = [
    c.email,
    c.phone,
    ...(c.links ?? []).map((l) => l.url).filter(Boolean),
    c.location,
  ].filter((v): v is string => Boolean(v));

  /**
   * Where the contact details land, which the layout decides.
   *
   * A plain column puts them on one line directly under the name — which is
   * what the scorer's "contact near the top" check rewards, since it measures
   * how far down the document the email sits.
   *
   * A sidebar cannot do that. It gives them a CONTACT heading and a line each
   * inside the left column, and a left column is read *first* by a parser, so
   * they end up above the name rather than below it and spread over four lines
   * instead of one. Writing that out honestly is the difference between a
   * score that describes the file and a score that flatters it.
   */
  const contactInAside = layout === "sidebar";
  if (contact.length && !contactInAside) out.push(contact.join(" · "));

  /**
   * Each section as the lines a parser would pull out of it.
   *
   * Split into a table so the *order* can be decided by the layout rather
   * than by where the code happens to sit. That matters more than it looks:
   * a sidebar template really does put skills and education before the
   * summary in reading order, and scoring it as if it were a single column
   * would produce a number describing a document nobody has.
   */
  const section: Record<SectionKey, () => string[]> = {
    summary: () => (c.summary ? ["", "SUMMARY", c.summary] : []),

    experience: () => {
      if (!c.roles?.length) return [];
      const lines = ["", "EXPERIENCE"];
      for (const r of c.roles) {
        // Title and company on one line: a company alone on its own line is
        // short, capitalised and would be mistaken for a section heading.
        const head = [r.title, r.company].filter(Boolean).join(" — ");
        if (head) lines.push("", head);

        const when = [r.start, r.is_current ? "Present" : r.end].filter(Boolean).join(" – ");
        if (when) lines.push(when);

        for (const h of r.highlights ?? []) {
          if (h?.trim()) lines.push(`• ${h.trim()}`);
        }
      }
      return lines;
    },

    // Projects sit between experience and education: for a fresher they are
    // the strongest thing on the page, and leading with education would lead
    // with the weakest section a reader looks at.
    projects: () => {
      if (!c.projects?.length) return [];
      const lines = ["", "PROJECTS"];
      for (const p of c.projects) {
        const head = [p.name, p.link].filter(Boolean).join(" — ");
        if (head) lines.push("", head);
        if (p.description) lines.push(p.description);
        for (const h of p.highlights ?? []) {
          if (h?.trim()) lines.push(`• ${h.trim()}`);
        }
      }
      return lines;
    },

    education: () => {
      if (!c.education?.length) return [];
      // In a narrow column the degree and the institution get a line each
      // rather than being joined by a dash — which is what the document does,
      // so it is what the scorer has to read.
      const stacked = aside.includes("education");
      const lines = ["", "EDUCATION"];
      for (const e of c.education) {
        const parts = [e.degree, e.institution].filter(Boolean) as string[];
        if (parts.length) lines.push(stacked ? parts.join("\n") : parts.join(" — "));
        if (e.year) lines.push(String(e.year));
      }
      return lines;
    },

    skills: () => (c.skills?.length ? ["", "SKILLS", c.skills.join(", ")] : []),

    certifications: () =>
      c.certifications?.length ? ["", "CERTIFICATIONS", c.certifications.join(", ")] : [],

    // One per line rather than comma-joined: an achievement is a sentence,
    // and three of them run together read as one long one.
    achievements: () =>
      c.achievements?.length ? ["", "ACHIEVEMENTS", ...c.achievements.map((a) => `• ${a}`)] : [],
  };

  // Left column first, then the main one — which is what a left-to-right
  // parser does with a sidebar, and precisely why a sidebar costs points.
  if (contactInAside && contact.length) out.push("", "CONTACT", ...contact);
  for (const key of [...aside, ...main]) out.push(...section[key]());

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ----------------------------------------------------------------- score */

/** A4 at our margins and body size, near enough for a length estimate. */
const CHARS_PER_LINE = 95;
const LINES_PER_PAGE = 48;

/**
 * The draft, measured as if it had already been printed.
 *
 * `multiColumnPages` used to be hard-coded to zero, which was true when there
 * was one template and it had one column. It is a lie now: three of the ten
 * templates put a sidebar down the left and two split the body in half, and a
 * multi-column page is precisely the thing the machine-readability checks
 * deduct for.
 *
 * Reporting it honestly means a decorative template scores lower than a plain
 * one — which is the whole truth of the trade, and the number somebody should
 * see on the card before they choose.
 */
export function draftFacts(c: DraftContent, template?: string | null): ResumeFacts {
  const { layout } = templateById(template);
  const text = draftToText(c, template);

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
    // Every page of a two-column layout is a two-column page: the sidebar runs
    // the full height rather than stopping partway down.
    multiColumnPages: layout === "sidebar" || layout === "split" ? pages : 0,
  };
}

/** The same score an upload gets, from the same function. */
export function scoreDraft(c: DraftContent, template?: string | null): AtsResult {
  return analyseResume(draftFacts(c, template));
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
