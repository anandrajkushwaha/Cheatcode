/**
 * The part of a resume that is the person's own, not the template's sample.
 *
 * A draft opens on the template's sample (lib/app/starter-content.ts) for the
 * person to write over — and many don't, or only change their name. Matching
 * jobs against that would tell them a sample data analyst's skills "fit 300
 * jobs". So sample lines are removed before anything is scored: an untouched
 * sample skills list goes entirely, a sample's job (same title and company)
 * goes, and any summary, headline or bullet that is word for word a sample's
 * is dropped. Pure: npm test runs it.
 */
import type { Resume } from "@/lib/app/resume-schema";

const key = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function ownContent(r: Resume, samples: Resume[]): Resume {
  const lines = new Set<string>();
  const skillSets = new Set<string>();
  const roleKeys = new Set<string>();
  for (const s of samples) {
    for (const t of [s.summary, s.headline, ...s.roles.flatMap((x) => x.highlights), ...s.projects.flatMap((p) => [p.description, ...p.highlights])]) {
      if (key(t)) lines.add(key(t));
    }
    skillSets.add([...s.skills].map(key).sort().join("|"));
    for (const x of s.roles) roleKeys.add(`${key(x.title)}|${key(x.company)}`);
  }
  const mine = [...r.skills].map(key).sort().join("|");
  const keep = (t: string | null) => (t && !lines.has(key(t)) ? t : null);
  return {
    ...r,
    summary: keep(r.summary),
    headline: keep(r.headline),
    skills: mine && skillSets.has(mine) ? [] : r.skills,
    roles: r.roles
      .filter((x) => !roleKeys.has(`${key(x.title)}|${key(x.company)}`))
      .map((x) => ({ ...x, highlights: x.highlights.filter((h) => !lines.has(key(h))) })),
    projects: r.projects.map((p) => ({ ...p, description: keep(p.description), highlights: p.highlights.filter((h) => !lines.has(key(h))) })),
  };
}
