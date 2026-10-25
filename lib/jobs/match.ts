/**
 * How well a job fits somebody — the number on every job card.
 *
 * Deliberately arithmetic, not a model call: it runs on every card of every
 * page, it has to be the same number each time it is shown, and it has to be
 * explainable in one line ("Missing: SQL, Power BI"). The model's fit
 * judgement comes later, on the one job somebody prepares an application for.
 *
 * Weights: skills 55, experience 25, role 10, location 10. A posting that
 * lists no skills is scored on the rest, rescaled, so it is not punished for
 * the board's data. Pure: npm test runs it.
 */

export type Candidate = {
  skills: string[];
  /** All of the resume's text, lowercased — a skill named only in a bullet still counts. */
  text: string;
  years: number | null;
  cities: string[];
  remote: boolean;
  targetRole: string | null;
};

export type JobFacts = {
  title: string;
  skills: string[];
  years_min: number | null;
  years_max: number | null;
  cities: string[];
  is_remote: boolean;
};

export type Match = { score: number; matched: string[]; missing: string[] };

const ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  "node.js": "node",
  nodejs: "node",
  "react.js": "react",
  reactjs: "react",
  "next.js": "nextjs",
  "vue.js": "vue",
  golang: "go",
  "c sharp": "c#",
  postgres: "postgresql",
  "ms excel": "excel",
  "microsoft excel": "excel",
  "power-bi": "power bi",
  powerbi: "power bi",
  ml: "machine learning",
  k8s: "kubernetes",
  gcp: "google cloud",
  aws: "amazon web services",
};

export function norm(s: string): string {
  const k = s.toLowerCase().replace(/\s+/g, " ").trim();
  return ALIASES[k] ?? k;
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether the candidate has this skill: listed, or named in their text as a whole word. */
export function hasSkill(c: Candidate, skill: string): boolean {
  const n = norm(skill);
  if (!n) return false;
  if (c.skills.some((s) => norm(s) === n)) return true;
  const forms = new Set([n, skill.toLowerCase().trim()]);
  for (const [alias, canon] of Object.entries(ALIASES)) if (canon === n) forms.add(alias);
  return [...forms].some((f) => new RegExp(`(?<![\\w+#.])${escape(f)}(?![\\w+#])`, "i").test(c.text));
}

const WORDS = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set(["and", "the", "for", "with", "senior", "junior", "lead", "associate", "intern", "trainee", "engineer", "manager", "executive", "specialist"]);

export function matchJob(c: Candidate, job: JobFacts): Match {
  const skills = [...new Set(job.skills.map((s) => s.trim()).filter(Boolean))];
  const matched = skills.filter((s) => hasSkill(c, s));
  const missing = skills.filter((s) => !matched.includes(s));

  let got = 0;
  let max = 0;

  if (skills.length) {
    max += 55;
    got += 55 * (matched.length / skills.length);
  }

  // Experience: inside the range is full marks; a year short loses a little,
  // far short or far over loses most.
  if (c.years !== null && (job.years_min !== null || job.years_max !== null)) {
    max += 25;
    const lo = job.years_min ?? 0;
    const hi = job.years_max ?? lo + 5;
    const gap = c.years < lo ? lo - c.years : c.years > hi + 3 ? c.years - hi - 3 : 0;
    got += 25 * Math.max(0, 1 - gap / 3);
  }

  // Role: shared words between what they want and the title.
  const want = c.targetRole ? WORDS(c.targetRole) : [];
  if (want.length) {
    max += 10;
    const title = new Set(WORDS(job.title));
    got += 10 * (want.filter((w) => title.has(w)).length / want.length);
  }

  // Location: one of their cities, or remote when they are open to it.
  if (c.cities.length || c.remote) {
    max += 10;
    const mine = new Set(c.cities.map((x) => x.toLowerCase()));
    const ok = (job.is_remote && c.remote) || job.cities.some((x) => mine.has(x.toLowerCase()));
    got += ok ? 10 : 0;
  }

  const score = max ? Math.round((got / max) * 100) : 0;
  return { score, matched, missing };
}
