/**
 * The honesty guard on an application pack, and the tailored resume it makes.
 *
 * Whatever the model returned, only what the resume supports survives: a
 * skill the resume does not show moves to "missing", bullets can only rewrite
 * roles that exist, and no role gains bullets. Pure: npm test runs it.
 */
import type { Resume } from "@/lib/app/resume-schema";
import { hasSkill, type Candidate } from "@/lib/jobs/match";

export type Pack = {
  fit_score: number;
  verdict: string;
  strengths: string[];
  gaps: string[];
  headline: string;
  summary: string;
  skills: string[];
  roles: { index: number; highlights: string[] }[];
  cover_letter: string;
  answers: { question: string; answer: string }[];
  keywords_missing: string[];
  review_notes: string[];
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, n: number, max = 200) =>
  Array.isArray(v) ? v.map((x) => text(x, max)).filter(Boolean).slice(0, n) : [];

export function clean(raw: Partial<Pack>, resume: Resume, candidate: Candidate): Pack {
  const proposed = list(raw.skills, 30, 60);
  const skills = proposed.filter((s) => hasSkill(candidate, s));
  const dropped = proposed.filter((s) => !skills.includes(s));

  const roles = (Array.isArray(raw.roles) ? raw.roles : [])
    .map((r) => ({ index: Number(r?.index), highlights: list(r?.highlights, 8, 320) }))
    .filter((r) => Number.isInteger(r.index) && r.index >= 0 && r.index < resume.roles.length)
    .map((r) => ({ ...r, highlights: r.highlights.slice(0, resume.roles[r.index].highlights.length) }))
    .filter((r, i, all) => r.highlights.length && all.findIndex((x) => x.index === r.index) === i);

  const answers = (Array.isArray(raw.answers) ? raw.answers : [])
    .map((a) => ({ question: text(a?.question, 160), answer: text(a?.answer, 900) }))
    .filter((a) => a.question && a.answer)
    .slice(0, 6);

  const score = Math.round(Number(raw.fit_score));
  return {
    fit_score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    verdict: text(raw.verdict, 300),
    strengths: list(raw.strengths, 4, 240),
    gaps: list(raw.gaps, 4, 240),
    headline: text(raw.headline, 120),
    summary: text(raw.summary, 600),
    skills,
    roles,
    cover_letter: text(raw.cover_letter, 2600),
    answers,
    keywords_missing: [...new Set([...list(raw.keywords_missing, 12, 60), ...dropped])].slice(0, 12),
    review_notes: list(raw.review_notes, 4, 240),
  };
}

/** The resume, as tailored by the pack: same person, same facts, aimed at this job. */
export function tailoredResume(resume: Resume, pack: Pack): Resume {
  const lead = pack.skills;
  const rest = resume.skills.filter((s) => !lead.some((l) => l.toLowerCase() === s.toLowerCase()));
  return {
    ...resume,
    headline: pack.headline || resume.headline,
    summary: pack.summary || resume.summary,
    skills: [...lead, ...rest],
    roles: resume.roles.map((r, i) => {
      const t = pack.roles.find((x) => x.index === i);
      return t ? { ...r, highlights: t.highlights } : r;
    }),
  };
}
