import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume } from "@/lib/app/account";
import { searchJobs } from "@/lib/jobs/query";
import { greeting } from "@/lib/app/agent-greeting";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * What the agent knows about you before you say anything.
 *
 * Returns two things that are used at two different moments: `heading` goes on
 * screen the instant the agent opens, silently, and `opening` is held until
 * somebody actually starts a call. Nothing is spoken on open any more — see
 * lib/app/agent-greeting.ts for why that changed and what it used to do.
 *
 * The job count is a real query rather than an estimate, because a line
 * offering somebody twelve roles has to be able to produce twelve roles.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);

  const { jobs } = await searchJobs({
    cities: (profile?.preferred_cities ?? []).slice(0, 4),
    maxYears: profile?.years_experience ?? null,
    limit: 12,
  }).catch(() => ({ jobs: [] }));

  return Response.json({ ok: true, ...greeting(profile?.full_name, resume, jobs.length) });
}
