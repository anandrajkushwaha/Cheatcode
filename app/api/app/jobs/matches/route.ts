import { getSessionUser } from "@/lib/supabase/app";
import { getApplicant } from "@/lib/jobs/candidate";
import { matchingJobs } from "@/lib/jobs/matching";
import { accessFor, canSee, PASS_DAYS, PRICES } from "@/lib/jobs/unlocks";

export const dynamic = "force-dynamic";

/**
 * How many open jobs genuinely fit their resume, and the best three — for the
 * post-download popup. A locked match comes back without its company, place
 * or link: hidden on the server, not blurred over data the page already has.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const applicant = await getApplicant();
  if (!applicant.resume) return Response.json({ ok: true, count: 0, top: [] });
  const [all, access] = await Promise.all([
    matchingJobs(applicant.candidate),
    accessFor(user.id, user.email ?? null, applicant.profile),
  ]);
  return Response.json({
    ok: true,
    count: all.length,
    all: access.all,
    passUntil: access.passUntil,
    prices: { job: PRICES.job / 100, pass: PRICES.pass / 100, passDays: PASS_DAYS },
    top: all.slice(0, 3).map(({ job, match }) => {
      const open = canSee(access, job.id);
      return {
        id: job.id,
        title: job.title,
        score: match.score,
        matched: match.matched.slice(0, 3),
        locked: !open,
        company: open ? job.company : null,
        where: open ? (job.is_remote ? "Remote" : job.cities.slice(0, 2).join(", ") || job.location_raw || "India") : null,
        applyUrl: open ? job.apply_url : null,
      };
    }),
  });
}
