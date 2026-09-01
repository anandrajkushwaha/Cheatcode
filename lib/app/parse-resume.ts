import "server-only";
import type { ParsedResume } from "@/lib/app/account";
import { llmJson } from "@/lib/app/llm";

/**
 * Turn resume text into structured fields.
 *
 * This is the hinge the whole product turns on. Matching cannot rank a job
 * against a blob of text, and the agent cannot ask a useful question without
 * knowing what someone already does. Everything downstream reads these fields.
 *
 * A model rather than a rules engine, because resumes have no format: dates
 * appear six ways, titles are invented, and Indian service-company
 * designations ("Systems Engineer") mean something different from the market
 * title. A model handles that; regexes do not.
 *
 * The output is never trusted. It is validated and coerced before it is
 * returned, because a model asked for JSON will occasionally supply prose, a
 * number where a string belongs, or forty skills of one character each.
 */

/**
 * An override for this one call. Unset is the normal case — whichever
 * provider is configured picks its own model.
 */
const MODEL = process.env.PARSE_MODEL ?? process.env.GEMINI_PARSE_MODEL ?? null;

/** Trimmed hard: a resume beyond this is a portfolio, and tokens cost money. */
const MAX_CHARS = 24_000;

const SCHEMA = {
  type: "object",
  properties: {
    full_name: { type: "string", nullable: true },
    email: { type: "string", nullable: true },
    phone: { type: "string", nullable: true },
    location: { type: "string", nullable: true },
    headline: { type: "string", nullable: true },
    summary: { type: "string", nullable: true },
    years_experience: { type: "number", nullable: true },
    skills: { type: "array", items: { type: "string" } },
    roles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", nullable: true },
          company: { type: "string", nullable: true },
          start: { type: "string", nullable: true },
          end: { type: "string", nullable: true },
          is_current: { type: "boolean" },
          highlights: { type: "array", items: { type: "string" } },
        },
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          degree: { type: "string", nullable: true },
          institution: { type: "string", nullable: true },
          year: { type: "string", nullable: true },
        },
      },
    },
    certifications: { type: "array", items: { type: "string" } },
  },
} as const;

const INSTRUCTIONS = `You extract structured data from a resume. Indian job market.

Rules:
- Copy what the resume says. Never invent a skill, employer, date or achievement.
- If something is absent, use null or an empty array. Do not guess.
- years_experience: total professional experience in years, one decimal. Count full-time
  work only — exclude internships and academic projects. A fresher is 0.
- skills: concrete, searchable things only — languages, frameworks, tools, platforms,
  named methodologies. Never soft skills like "team player" or "hard working".
  Deduplicate. Normalise casing to how the industry writes it (React, Node.js, SQL, AWS).
- roles: newest first. is_current is true only if the resume says so (an end date of
  "Present", "Current", "Till date", or no end date on the most recent role).
- start and end: "MMM YYYY" where the month is known, otherwise "YYYY". Never a range.
- headline: how this person would describe themselves in under 12 words. If the resume
  has no summary line, build one from the most recent role. Never flattery.
- Indian service companies use internal designations (Systems Engineer, Programmer
  Analyst, Associate). Keep the title exactly as written — do not translate it.`;

type ParseOk = { ok: true; parsed: ParsedResume; model: string };
type ParseFail = { ok: false; error: string };

export async function parseResume(text: string): Promise<ParseOk | ParseFail> {
  const clean = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length < 120) {
    return {
      ok: false,
      error:
        "Almost no text came out of that file — it is very likely an image or a scan, " +
        "which is exactly what an ATS sees too.",
    };
  }

  // Structured output: the model is constrained to the schema rather than
  // asked politely for JSON and hoped at.
  const result = await llmJson({
    system: INSTRUCTIONS,
    user: clean.slice(0, MAX_CHARS),
    schema: SCHEMA,
    name: "parsed_resume",
    pin: MODEL,
    temperature: 0,
    timeoutMs: 45_000,
  });

  if (!result.ok) return { ok: false, error: result.error };

  return { ok: true, parsed: coerce(result.data), model: result.model };
}

/* ----------------------------------------------------------------- shaping */

const str = (v: unknown, max = 200): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.toLowerCase() !== "null" ? s.slice(0, max) : null;
};

const strList = (v: unknown, max: number, itemMax = 60): string[] => {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    const s = str(item, itemMax);
    // One-character "skills" are parsing noise, not skills.
    if (!s || s.length < 2) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
};

/**
 * Force the model's answer into the shape the rest of the app expects.
 *
 * Every field is clamped. years_experience in particular: a model that misreads
 * a graduation year can return 2019, and an unclamped number would quietly
 * exclude someone from every job they are qualified for.
 */
function coerce(input: unknown): ParsedResume {
  const d = (input ?? {}) as Record<string, unknown>;

  const yearsRaw = typeof d.years_experience === "number" ? d.years_experience : null;
  const years =
    yearsRaw !== null && Number.isFinite(yearsRaw)
      ? Math.max(0, Math.min(50, Math.round(yearsRaw * 10) / 10))
      : null;

  const roles = (Array.isArray(d.roles) ? d.roles : [])
    .slice(0, 15)
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      return {
        title: str(row.title, 120),
        company: str(row.company, 120),
        start: str(row.start, 20),
        end: str(row.end, 20),
        is_current: row.is_current === true,
        highlights: strList(row.highlights, 8, 300),
      };
    })
    .filter((r) => r.title || r.company);

  const education = (Array.isArray(d.education) ? d.education : [])
    .slice(0, 8)
    .map((e) => {
      const row = (e ?? {}) as Record<string, unknown>;
      return {
        degree: str(row.degree, 120),
        institution: str(row.institution, 160),
        year: str(row.year, 20),
      };
    })
    .filter((e) => e.degree || e.institution);

  return {
    full_name: str(d.full_name, 120),
    email: str(d.email, 160),
    phone: str(d.phone, 40),
    location: str(d.location, 120),
    headline: str(d.headline, 160),
    summary: str(d.summary, 800),
    years_experience: years,
    skills: strList(d.skills, 60),
    roles,
    education,
    certifications: strList(d.certifications, 20, 160),
  };
}

/** The columns matching will query, pulled out of the JSON for indexing. */
export function flatten(parsed: ParsedResume) {
  const current = parsed.roles?.find((r) => r.is_current) ?? parsed.roles?.[0];
  return {
    skills: parsed.skills ?? [],
    years_experience: parsed.years_experience ?? null,
    latest_title: current?.title ?? null,
    latest_company: current?.company ?? null,
  };
}
