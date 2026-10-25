import { getSessionUser } from "@/lib/supabase/app";
import { getApplicant } from "@/lib/jobs/candidate";
import { getApplicationForJob, getJob, packsLeft, savePack, FREE_PACKS_PER_MONTH } from "@/lib/jobs/applications";
import { preparePack } from "@/lib/jobs/apply-pack";
import { matchJob } from "@/lib/jobs/match";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

/**
 * Prepare the application pack for one job (lib/jobs/apply-pack.ts).
 *
 * A pack that already exists comes back as it is; `regenerate` asks for a new
 * one. Either way a new pack is counted against the free allowance before
 * the model is called, so a refused request costs nothing.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  let body: { jobId?: unknown; regenerate?: unknown };
  try {
    body = await request.json();
  } catch {
    return bad("Could not read that request.");
  }
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const job = await getJob(jobId);
  if (!job) return bad("That job is no longer listed.", 404);

  const existing = await getApplicationForJob(job.id);
  if (existing?.pack && body.regenerate !== true) return Response.json({ ok: true, application: existing });

  const applicant = await getApplicant();
  if (!applicant.resume) {
    return bad("Add your resume first — the application is built from it.", 409, { needsResume: true });
  }

  const left = await packsLeft(user.id, user.email ?? null, applicant.profile);
  if (left <= 0) {
    return bad(
      `You've used your ${FREE_PACKS_PER_MONTH} free applications this month. Upgrade to Pro for unlimited.`,
      402,
      { upgrade: true },
    );
  }

  const where = job.is_remote ? "Remote" : job.cities.join(", ") || job.location_raw || "India";
  const result = await preparePack(
    { title: job.title, company: job.company, description: job.description, skills: job.skills, location: where },
    applicant.resume,
    applicant.profile,
    applicant.candidate,
    user.id,
  );
  if (!result.ok) return bad(result.error, result.status);

  const score = matchJob(applicant.candidate, job).score;
  try {
    const application = await savePack(user.id, job, result.pack, score);
    return Response.json({ ok: true, application });
  } catch (e) {
    console.error("apply: save failed", String(e).slice(0, 300));
    return bad("Your application was written but could not be saved. Try again.", 500);
  }
}
