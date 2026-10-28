import "server-only";
import { createAppServerClient } from "@/lib/supabase/app";
import type { JobRow } from "@/lib/jobs/query";
import { isGenuine, matchJob, type Candidate, type Match } from "@/lib/jobs/match";

/**
 * The jobs that genuinely fit somebody's resume, best first.
 *
 * Scored in the app rather than in SQL: the score is the same arithmetic the
 * cards show (lib/jobs/match.ts), so the popup's "23 jobs match" and the list
 * it opens can never disagree. The pool is the most recent active postings —
 * a few hundred rows, scored in well under a millisecond each.
 */

const POOL = 800;
const COLUMNS =
  "id,title,company,department,location_raw,cities,is_remote,employment_type,seniority,years_min,years_max,salary_min,salary_max,salary_currency,salary_period,skills,apply_url,posted_at";

export type Matched = { job: JobRow; match: Match };

export async function matchingJobs(candidate: Candidate): Promise<Matched[]> {
  if (!candidate.text && !candidate.skills.length) return [];
  const supabase = await createAppServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("jobs")
    .select(COLUMNS)
    .eq("is_active", true)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(POOL);
  const rows = ((data ?? []) as Omit<JobRow, "total_count">[]).map((r) => ({ ...r, skills: r.skills ?? [], cities: r.cities ?? [], total_count: 0 }));
  const scored = rows
    .map((job) => ({ job, match: matchJob(candidate, job) }))
    .filter(({ job, match }) => isGenuine(match, job))
    .sort((a, b) => b.match.score - a.match.score);
  // One company often posts the same role more than once (a city each, or a
  // re-post). Counted once, or "2 jobs" is one job shown twice.
  const seen = new Set<string>();
  return scored.filter(({ job }) => {
    const k = `${job.company}|${job.title}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Specific active jobs, in the order given — the ATS checker's matches (/app/jobs?picked=…). */
export async function jobsByIds(ids: string[]): Promise<JobRow[]> {
  if (!ids.length) return [];
  const supabase = await createAppServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("jobs").select(COLUMNS).eq("is_active", true).in("id", ids);
  const byId = new Map(((data ?? []) as Omit<JobRow, "total_count">[]).map((r) => [r.id, { ...r, skills: r.skills ?? [], cities: r.cities ?? [], total_count: 0 }]));
  return ids.map((id) => byId.get(id)).filter((r): r is JobRow => Boolean(r));
}
