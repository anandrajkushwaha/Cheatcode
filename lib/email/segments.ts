import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { cleanResume, resumeIsEmpty, type Resume } from "@/lib/app/resume-schema";
import type { Profile } from "@/lib/app/account";
import { candidateFrom } from "@/lib/jobs/candidate";
import { genuineMatches, matchPool } from "@/lib/jobs/matching";
import { isOwnerEmail } from "@/lib/analytics/owner";
import type { Teaser } from "@/lib/email/ats-upload";

/**
 * Every signed-up person, sorted into who should get which email, by the
 * same matcher the jobs page and the match popup use.
 *
 *   matches          their saved resume genuinely fits open jobs
 *   resume_no_match  they have a resume, and it fits nothing yet
 *   no_resume        nothing saved to match on
 *
 * Left out: sign-ups with no real address (phone sign-ups get a placeholder
 * at phone.cheatcodeapp.com), the owner's own accounts, and anyone who
 * unsubscribed.
 */

export type Segment = "matches" | "resume_no_match" | "no_resume";

export type Person = {
  userId: string;
  email: string;
  name: string | null;
  segment: Segment;
  matches: number;
  best: number | null;
};

export async function getSegments(): Promise<
  { ok: true; people: Person[]; openJobs: number; teasers: Teaser[]; skipped: number } | { ok: false; error: string }
> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, error: "Supabase service key is not configured." };

  const [prof, drafts, optouts, pool, active] = await Promise.all([
    db.from("profiles").select("id,email,full_name,city,preferred_cities,years_experience,open_to_remote,target_roles,current_title").limit(5000),
    db.from("resume_drafts").select("user_id,content,is_primary,updated_at").order("is_primary", { ascending: false }).order("updated_at", { ascending: false }).limit(20000),
    db.from("email_optouts").select("email").limit(20000),
    matchPool(db),
    db.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  if (prof.error) return { ok: false, error: prof.error.message };

  const primary = new Map<string, Resume>();
  for (const d of (drafts.data ?? []) as { user_id: string; content: unknown }[]) {
    if (primary.has(d.user_id) || !d.content) continue;
    const r = cleanResume(d.content as Resume);
    if (!resumeIsEmpty(r)) primary.set(d.user_id, r);
  }
  const out = new Set(((optouts.data ?? []) as { email: string }[]).map((o) => o.email.toLowerCase()));

  let skipped = 0;
  const people: Person[] = [];
  for (const p of (prof.data ?? []) as (Profile & { id: string; email: string | null; full_name: string | null })[]) {
    const email = (p.email ?? "").trim().toLowerCase();
    if (!email || email.endsWith("@phone.cheatcodeapp.com") || isOwnerEmail(email) || out.has(email)) {
      skipped += 1;
      continue;
    }
    const resume = primary.get(p.id) ?? null;
    const found = resume ? genuineMatches(candidateFrom(resume, p), pool) : [];
    people.push({
      userId: p.id,
      email,
      name: p.full_name,
      segment: !resume ? "no_resume" : found.length ? "matches" : "resume_no_match",
      matches: found.length,
      best: found[0]?.match.score ?? null,
    });
  }

  // Three real openings for the email's "hiring now" strip: recent, with a city.
  const teasers = pool
    .filter((j) => j.title && (j.cities?.length || j.location_raw))
    .slice(0, 3)
    .map((j) => ({ title: j.title, where: j.cities?.[0] ?? j.location_raw ?? null }));

  return { ok: true, people, openJobs: active.count ?? pool.length, teasers, skipped };
}
