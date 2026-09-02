/**
 * The resume, as one object with one definition.
 *
 * Everything writes here: the parser reading an uploaded file, the agent
 * hearing something in a call, a person typing into a form, a model proposing
 * a rewrite. Before this module there were two cleaners — `coerce()` beside
 * the parser and `cleanDraft()` beside the builder — doing the same job with
 * different rules, and they disagreed on the case that mattered most: a
 * graduation year typed into the years-of-experience box came out of one as
 * fifty years and out of the other as blank. A wrong number that looks
 * deliberate is worse than a missing one, so the blank won and this is the
 * only cleaner now.
 *
 * No validation library. What is wanted here is not rejection — a model that
 * returns a bad field should lose the field, not the whole resume — and a
 * schema library would need a `.catch()` on every leaf to behave that way,
 * which is longer than the coercion it replaces. `FIELDS` below carries what a
 * schema library could not: the labels and input types a form needs.
 *
 * Deliberately dependency-free and not `server-only`, because the form
 * generator that reads `FIELDS` runs in the browser.
 */

/* ------------------------------------------------------------------ shape */

export type ResumeRole = {
  title: string | null;
  company: string | null;
  start: string | null;
  end: string | null;
  is_current: boolean;
  highlights: string[];
};

export type ResumeEducation = {
  degree: string | null;
  institution: string | null;
  year: string | null;
};

/**
 * Projects, which is the section a fresher's resume is mostly made of.
 *
 * There was nowhere to put them before, so a student with three good projects
 * and no job history parsed as an almost empty document and scored like one.
 */
export type ResumeProject = {
  name: string | null;
  description: string | null;
  link: string | null;
  highlights: string[];
};

export type ResumeLink = { label: string | null; url: string | null };

/** Where a resume is in its life. `ready` means the person said so, not us. */
export type ResumeStatus = "draft" | "ready";

export type Resume = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  years_experience: number | null;
  /** What they are aiming at. Drives tailoring and keyword matching. */
  target_role: string | null;
  status: ResumeStatus;
  skills: string[];
  roles: ResumeRole[];
  education: ResumeEducation[];
  projects: ResumeProject[];
  certifications: string[];
  achievements: string[];
  links: ResumeLink[];
};

/** An empty one, so nothing has to build this shape by hand. */
export function emptyResume(): Resume {
  return {
    full_name: null,
    email: null,
    phone: null,
    location: null,
    headline: null,
    summary: null,
    years_experience: null,
    target_role: null,
    status: "draft",
    skills: [],
    roles: [],
    education: [],
    projects: [],
    certifications: [],
    achievements: [],
    links: [],
  };
}

/* ------------------------------------------------------------------ limits */

/**
 * Caps rather than rejections.
 *
 * Somebody who pasted sixty skills gets the first sixty kept, not an error
 * telling them to count. The only things dropped outright are rows with
 * nothing in them, because an empty row renders as a gap in a document
 * somebody is about to send to an employer.
 *
 * The bullet limit is 700 and not the 300 the parser used to apply. A bullet
 * being edited is allowed to be long and bad on its way to being short and
 * good, and the same object holds both states.
 */
const LIMITS = {
  name: 120,
  email: 160,
  phone: 40,
  location: 120,
  headline: 160,
  summary: 1200,
  targetRole: 120,
  skill: 60,
  skills: 60,
  role: 120,
  roles: 15,
  date: 30,
  bullet: 700,
  bullets: 12,
  education: 8,
  degree: 120,
  institution: 160,
  projects: 10,
  projectName: 120,
  projectDescription: 600,
  certifications: 20,
  certification: 160,
  achievements: 15,
  achievement: 300,
  links: 8,
  linkLabel: 40,
  url: 200,
} as const;

/* --------------------------------------------------------------- cleaning */

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  // A model asked for null sometimes writes the word instead.
  const s = v.trim().replace(/\s+/g, " ");
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  return s.slice(0, max);
}

/** Multi-line text — a summary keeps its paragraphs, a name does not. */
function block(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!s || s.toLowerCase() === "null") return null;
  return s.slice(0, max);
}

function list(v: unknown, max: number, each: number, minLength = 1): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const s = text(item, each);
    if (!s || s.length < minLength) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function row(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

/**
 * Out of range is dropped, not clamped.
 *
 * This is the whole reason the two old cleaners had to become one. Clamping
 * turned a graduation year in the wrong box — 2019 — into fifty years of
 * experience, silently, and fifty years of experience excludes somebody from
 * every job they are actually qualified for. Nothing is better than wrong.
 */
function years(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < 0 || v > 50) return null;
  return Math.round(v * 10) / 10;
}

/** Clean anything that claims to be a resume. Never throws. */
export function cleanResume(input: unknown): Resume {
  const d = row(input);

  const roles = (Array.isArray(d.roles) ? d.roles : [])
    .slice(0, LIMITS.roles)
    .map((r): ResumeRole => {
      const e = row(r);
      return {
        title: text(e.title, LIMITS.role),
        company: text(e.company, LIMITS.role),
        start: text(e.start, LIMITS.date),
        end: text(e.end, LIMITS.date),
        is_current: e.is_current === true,
        highlights: list(e.highlights, LIMITS.bullets, LIMITS.bullet),
      };
    })
    .filter((r) => r.title || r.company || r.highlights.length);

  const education = (Array.isArray(d.education) ? d.education : [])
    .slice(0, LIMITS.education)
    .map((x): ResumeEducation => {
      const e = row(x);
      return {
        degree: text(e.degree, LIMITS.degree),
        institution: text(e.institution, LIMITS.institution),
        year: text(e.year, LIMITS.date),
      };
    })
    .filter((e) => e.degree || e.institution);

  const projects = (Array.isArray(d.projects) ? d.projects : [])
    .slice(0, LIMITS.projects)
    .map((x): ResumeProject => {
      const e = row(x);
      return {
        name: text(e.name, LIMITS.projectName),
        description: block(e.description, LIMITS.projectDescription),
        link: text(e.link, LIMITS.url),
        highlights: list(e.highlights, LIMITS.bullets, LIMITS.bullet),
      };
    })
    .filter((p) => p.name || p.description || p.highlights.length);

  const links = (Array.isArray(d.links) ? d.links : [])
    .slice(0, LIMITS.links)
    .map((x): ResumeLink => {
      const e = row(x);
      return { label: text(e.label, LIMITS.linkLabel), url: text(e.url, LIMITS.url) };
    })
    .filter((l) => l.url);

  return {
    full_name: text(d.full_name, LIMITS.name),
    email: text(d.email, LIMITS.email),
    phone: text(d.phone, LIMITS.phone),
    location: text(d.location, LIMITS.location),
    headline: text(d.headline, LIMITS.headline),
    summary: block(d.summary, LIMITS.summary),
    years_experience: years(d.years_experience),
    target_role: text(d.target_role, LIMITS.targetRole),
    status: d.status === "ready" ? "ready" : "draft",
    // Two characters minimum: a one-letter "skill" is parsing debris, and a
    // resume listing "C" as a language is rarer than a stray bullet character.
    skills: list(d.skills, LIMITS.skills, LIMITS.skill, 2),
    roles,
    education,
    projects,
    certifications: list(d.certifications, LIMITS.certifications, LIMITS.certification, 2),
    achievements: list(d.achievements, LIMITS.achievements, LIMITS.achievement, 2),
    links,
  };
}

/* ------------------------------------------------------------------ gaps */

export type Gap = {
  field: string;
  /** What to say when asking for it. Written to be spoken, not read. */
  ask: string;
  /** Blocking gaps stop a resume being generated. The rest only weaken it. */
  required: boolean;
};

/**
 * What is missing, in the order worth asking for it.
 *
 * The agent uses this twice: to decide what to ask next in a conversation, and
 * to refuse to generate a resume that would be a fabrication. The `ask` lines
 * are phrased as a person would say them aloud, because that is where most of
 * them are used.
 */
export function resumeGaps(resume: Resume): Gap[] {
  const gaps: Gap[] = [];
  const add = (field: string, ask: string, required = false) =>
    gaps.push({ field, ask, required });

  if (!resume.full_name) add("full_name", "What name should go at the top?", true);

  const hasHistory = resume.roles.length > 0 || resume.projects.length > 0;
  if (!hasHistory) {
    add("roles", "Tell me about your most recent job — or a project, if you haven't worked yet.", true);
  }

  if (!resume.email && !resume.phone) {
    add("email", "How should employers reach you — email or phone?", true);
  }

  // Everything below weakens the resume without making it a lie.
  if (resume.skills.length < 4) add("skills", "What tools and languages do you actually use?");
  if (!resume.location) add("location", "Which city are you in?");
  if (!resume.education.length) add("education", "Where did you study, and what?");
  if (!resume.target_role) add("target_role", "What kind of role are you going for next?");
  if (!resume.summary) add("summary", "How would you describe yourself in a line?");

  const thin = resume.roles.filter((r) => r.highlights.length === 0);
  if (thin.length) {
    add(
      "highlights",
      `What did you actually do at ${thin[0].company ?? thin[0].title ?? "that job"}?`,
    );
  }

  return gaps;
}

/** Can a resume be generated from this without inventing anything? */
export function canGenerate(resume: Resume): { ok: boolean; missing: Gap[] } {
  const missing = resumeGaps(resume).filter((g) => g.required);
  return { ok: missing.length === 0, missing };
}

/** Is there enough here to render a document somebody would send? */
export function resumeIsEmpty(resume: Resume): boolean {
  return (
    !resume.full_name &&
    !resume.roles.length &&
    !resume.projects.length &&
    !resume.education.length &&
    !resume.skills.length
  );
}

/* ----------------------------------------------------------------- fields */

export type FieldSpec = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "url" | "number" | "textarea" | "list";
  section: "personal" | "about" | "target";
  required?: boolean;
  /** Shown under the input. One line, concrete. */
  hint?: string;
  /**
   * The field this actually writes into, when it is not a field of its own.
   *
   * `linkedin` is not a column on a resume — it is one row in `links`. But
   * asking somebody mid-call to fill in a repeating label-and-url table is a
   * worse experience than one box that says LinkedIn, so the form gets the
   * ergonomic shape and `patchFromFields` puts it back where it belongs. One
   * representation in the document, whatever the form looks like.
   */
  writesTo?: "links";
  /** The label to store alongside the url, for a `writesTo: "links"` field. */
  linkLabel?: string;
};

/**
 * The single-value fields, described well enough to build a form from.
 *
 * This is what a schema library could not have given us. A form needs a label
 * a person recognises, an input type a phone keyboard responds to, and an
 * order that reads sensibly — none of which is type information. The agent
 * names fields from this list when it asks for something to be typed rather
 * than spoken, so a field it cannot name is a field it cannot request.
 *
 * The repeating sections — roles, education, projects — are not here. They are
 * edited as rows in the builder, not requested one field at a time mid-call.
 */
export const FIELDS: FieldSpec[] = [
  { name: "full_name", label: "Full name", type: "text", section: "personal", required: true },
  { name: "email", label: "Email", type: "email", section: "personal" },
  { name: "phone", label: "Phone", type: "tel", section: "personal" },
  { name: "location", label: "City", type: "text", section: "personal" },
  {
    name: "headline",
    label: "Headline",
    type: "text",
    section: "about",
    hint: "How you'd describe yourself in under twelve words.",
  },
  { name: "summary", label: "Summary", type: "textarea", section: "about" },
  {
    name: "years_experience",
    label: "Years of experience",
    type: "number",
    section: "about",
    hint: "Full-time work only. A fresher is 0.",
  },
  {
    name: "target_role",
    label: "Role you're going for",
    type: "text",
    section: "target",
    hint: "What the resume should be aimed at.",
  },

  /**
   * The two that are miserable to say out loud, which is the whole reason a
   * form exists at all. Reading a URL aloud and hearing it back wrong is where
   * people give up on talking to software.
   */
  {
    name: "linkedin",
    label: "LinkedIn",
    type: "url",
    section: "personal",
    writesTo: "links",
    linkLabel: "LinkedIn",
  },
  {
    name: "portfolio",
    label: "Portfolio or GitHub",
    type: "url",
    section: "personal",
    writesTo: "links",
    linkLabel: "Portfolio",
  },
  {
    name: "certifications",
    label: "Certifications",
    type: "list",
    section: "about",
    hint: "One per line.",
  },
];

export function fieldSpec(name: string): FieldSpec | undefined {
  return FIELDS.find((f) => f.name === name);
}

/* ------------------------------------------------------------- form values */

/**
 * What a filled-in form means, as a change to the resume.
 *
 * The form's shape and the document's shape are deliberately allowed to
 * differ — one box labelled "LinkedIn" is a better question than a repeating
 * table of labels and urls — and this is the one place that difference is
 * resolved. Anywhere else and the two would drift, which is how a product ends
 * up storing somebody's LinkedIn in two places and showing the older one.
 *
 * Takes the current resume because a link is an edit to a list: filling in
 * LinkedIn must replace the LinkedIn row rather than adding a second one, and
 * must not disturb the GitHub row sitting next to it.
 */
export function patchFromFields(
  values: Record<string, unknown>,
  current: Resume,
): Partial<Resume> {
  const patch: Record<string, unknown> = {};
  const links = [...(current.links ?? [])];
  let linksTouched = false;

  for (const [name, raw] of Object.entries(values)) {
    const spec = fieldSpec(name);
    if (!spec) continue;

    if (spec.writesTo === "links") {
      const url = typeof raw === "string" ? raw.trim() : "";
      const label = spec.linkLabel ?? spec.label;
      const at = links.findIndex((l) => l.label?.toLowerCase() === label.toLowerCase());

      linksTouched = true;
      if (!url) {
        // Clearing the box removes the row. That is the only way somebody can
        // delete a link they typed wrong, so it has to work.
        if (at >= 0) links.splice(at, 1);
      } else if (at >= 0) {
        links[at] = { label, url };
      } else {
        links.push({ label, url });
      }
      continue;
    }

    if (spec.type === "list") {
      // Newlines or commas, because people use both and correcting somebody's
      // punctuation is not worth a round of conversation.
      const text = typeof raw === "string" ? raw : "";
      patch[name] = text
        .split(/[\n,]+/)
        .map((v) => v.trim())
        .filter(Boolean);
      continue;
    }

    if (spec.type === "number") {
      const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
      patch[name] = Number.isFinite(n) ? n : null;
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : "";
    patch[name] = text || null;
  }

  if (linksTouched) patch.links = links;

  // Through the same cleaner as everything else, then narrowed to the keys
  // that were actually in the form — a patch is a change, not a whole
  // document, and sending the rest would overwrite fields nobody touched.
  const cleaned = cleanResume({ ...current, ...patch }) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) out[key] = cleaned[key];
  return out as Partial<Resume>;
}

/**
 * The current value of a form field, so the box arrives filled in.
 *
 * Somebody correcting a misheard email needs to see what is there. An empty
 * box asking for something we already have reads as the software forgetting.
 */
export function fieldValue(name: string, resume: Resume): string {
  const spec = fieldSpec(name);
  if (!spec) return "";

  if (spec.writesTo === "links") {
    const label = (spec.linkLabel ?? spec.label).toLowerCase();
    return (resume.links ?? []).find((l) => l.label?.toLowerCase() === label)?.url ?? "";
  }

  if (spec.type === "list") {
    const list = resume[name as keyof Resume];
    return Array.isArray(list) ? (list as string[]).join("\n") : "";
  }

  const value = resume[name as keyof Resume];
  return value === null || value === undefined ? "" : String(value);
}
