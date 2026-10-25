import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/app";
import { getApplicant } from "@/lib/jobs/candidate";
import { getApplicationForJob, getJob, packsLeft, FREE_PACKS_PER_MONTH } from "@/lib/jobs/applications";
import { matchJob } from "@/lib/jobs/match";
import { ApplyPanel } from "@/components/studio/ApplyPanel";

export const dynamic = "force-dynamic";

/**
 * One job, and everything needed to apply to it: fit, a tailored resume, a
 * cover letter, and the answers the company's form will ask for. The person
 * submits on the company's own site — we prepare, they press the button.
 */
export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, user] = await Promise.all([getJob(id), getSessionUser()]);
  if (!job || !user) notFound();

  const [application, applicant] = await Promise.all([getApplicationForJob(job.id), getApplicant()]);
  const left = await packsLeft(user.id, user.email ?? null, applicant.profile);
  const match = applicant.resume ? matchJob(applicant.candidate, job) : null;
  const where = job.is_remote ? "Remote" : job.cities.join(", ") || job.location_raw || "India";

  return (
    <div className="mx-auto max-w-[860px] space-y-6">
      <Link href="/app/jobs" className="text-[0.82rem] text-ink-50 hover:text-ink">
        ← Jobs
      </Link>

      <header>
        <p className="text-[0.82rem] text-ink-50">{job.company} · {where}</p>
        <h1 className="mt-1 text-[1.6rem] font-semibold leading-tight tracking-[-0.03em]">{job.title}</h1>
        {match && match.score > 0 && (
          <p className="mt-3 text-[0.85rem] text-ink-50">
            <span className="font-semibold text-ink">{match.score}% match</span> with your resume
            {match.matched.length > 0 && <> · You have: {match.matched.slice(0, 5).join(", ")}</>}
            {match.missing.length > 0 && <> · Missing: {match.missing.slice(0, 5).join(", ")}</>}
          </p>
        )}
      </header>

      <ApplyPanel
        jobId={job.id}
        applyUrl={job.apply_url}
        company={job.company}
        hasResume={Boolean(applicant.resume)}
        initial={application}
        left={Number.isFinite(left) ? left : null}
        freeLimit={FREE_PACKS_PER_MONTH}
        roles={(applicant.resume?.roles ?? []).map((r) => [r.title, r.company].filter(Boolean).join(" — "))}
      />
    </div>
  );
}
