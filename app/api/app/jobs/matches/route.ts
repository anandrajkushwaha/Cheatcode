import { getSessionUser } from "@/lib/supabase/app";
import { getApplicant } from "@/lib/jobs/candidate";
import { matchingJobs } from "@/lib/jobs/matching";

export const dynamic = "force-dynamic";

/** How many open jobs genuinely fit their resume, and the best three — for the post-download popup. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const applicant = await getApplicant();
  if (!applicant.resume) return Response.json({ ok: true, count: 0, top: [] });
  const all = await matchingJobs(applicant.candidate);
  return Response.json({
    ok: true,
    count: all.length,
    top: all.slice(0, 3).map(({ job, match }) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      where: job.is_remote ? "Remote" : job.cities.slice(0, 2).join(", ") || job.location_raw || "India",
      score: match.score,
      matched: match.matched.slice(0, 3),
    })),
  });
}
