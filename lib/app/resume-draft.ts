import type { ParsedResume, Profile, Resume } from "@/lib/app/account";
import { analyseResume, type AtsResult, type ResumeFacts } from "@/lib/tools/ats";

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

export type DraftContent = ParsedResume;

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
  const p = resume?.parsed ?? {};

  return {
    full_name: p.full_name ?? profile?.full_name ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    location: p.location ?? profile?.preferred_cities?.[0] ?? null,
    headline: p.headline ?? profile?.current_title ?? null,
    summary: p.summary ?? null,
    years_experience: p.years_experience ?? profile?.years_experience ?? null,
    skills: p.skills?.length ? p.skills : (resume?.skills ?? []),
    roles: p.roles ?? [],
    education: p.education ?? [],
    certifications: p.certifications ?? [],
    links: p.links ?? [],
  };
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
 * Caps rather than rejections: somebody who pasted forty skills should get
 * the first forty kept, not an error telling them to count. The one thing
 * that is dropped outright is a role or a bullet with nothing in it, because
 * an empty row renders as a gap in a PDF somebody is about to send out.
 */
export function cleanDraft(input: unknown): DraftContent {
  const d = (input ?? {}) as Record<string, unknown>;

  const text = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const s = v.trim().replace(/\s+/g, " ");
    return s ? s.slice(0, max) : null;
  };

  const list = (v: unknown, max: number, each: number): string[] => {
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of v) {
      const s = text(item, each);
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
      if (out.length >= max) break;
    }
    return out;
  };

  const roles = (Array.isArray(d.roles) ? d.roles : [])
    .slice(0, 12)
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      return {
        title: text(row.title, 100),
        company: text(row.company, 100),
        start: text(row.start, 30),
        end: text(row.end, 30),
        is_current: row.is_current === true,
        // 700 rather than 220: a bullet being edited is allowed to be long
        // and bad on the way to being short and good.
        highlights: list(row.highlights, 12, 700),
      };
    })
    .filter((r) => r.title || r.company || r.highlights.length);

  const education = (Array.isArray(d.education) ? d.education : [])
    .slice(0, 8)
    .map((e) => {
      const row = (e ?? {}) as Record<string, unknown>;
      return {
        degree: text(row.degree, 120),
        institution: text(row.institution, 120),
        year: text(row.year, 20),
      };
    })
    .filter((e) => e.degree || e.institution);

  const links = (Array.isArray(d.links) ? d.links : [])
    .slice(0, 6)
    .map((l) => {
      const row = (l ?? {}) as Record<string, unknown>;
      return { label: text(row.label, 40), url: text(row.url, 200) };
    })
    .filter((l) => l.url);

  /**
   * Out of range is dropped, not clamped.
   *
   * Clamping turned a graduation year typed into the wrong box — 2019 — into
   * fifty years of experience, silently, and a wrong number that looks
   * deliberate is worse than a blank one. The same reasoning as `bounded()`
   * in intent.ts, and the same mistake avoided.
   */
  const raw = d.years_experience;
  const years =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 50
      ? Math.round(raw * 10) / 10
      : null;

  return {
    full_name: text(d.full_name, 120),
    email: text(d.email, 160),
    phone: text(d.phone, 40),
    location: text(d.location, 120),
    headline: text(d.headline, 160),
    summary: text(d.summary, 1200),
    years_experience: years,
    skills: list(d.skills, 40, 60),
    roles,
    education,
    certifications: list(d.certifications, 12, 120),
    links,
  };
}

/** Is there enough here to render a document somebody would send? */
export function draftIsEmpty(c: DraftContent): boolean {
  return !c.full_name && !c.roles?.length && !c.education?.length && !c.skills?.length;
}
