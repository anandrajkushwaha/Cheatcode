import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/app";
import { getInterview } from "@/lib/interview/store";
import { Report } from "@/components/studio/interview/Report";

export const dynamic = "force-dynamic";

/**
 * The report for one interview.
 *
 * Model answers are fetched conditionally rather than fetched and hidden:
 * getInterview takes the plan and leaves them out of the query when it does
 * not apply, so an answer somebody has not paid for never reaches the browser
 * at all.
 */
export default async function InterviewFeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/studio/interviews");

  // The rewrite is always fetched. It is the thing the interview was for,
  // and the interview itself is what Pro gates — putting a second lock inside
  // something already paid for would be nickel-and-diming.
  const interview = await getInterview(id, user.id, true);
  if (!interview) notFound();

  // Still running — there is nothing to report on yet.
  if (!interview.feedback) redirect(`/studio/interviews/${id}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">
            How that interview went
          </h1>
          <p className="mt-1.5 text-[0.85rem] text-ink-50">
            {interview.session.topic}
            {interview.session.company ? ` · ${interview.session.company}` : ""}
          </p>
        </div>
        <Link
          href="/studio/interviews"
          className="shrink-0 text-[0.82rem] text-ink-50 underline underline-offset-4 hover:text-ink"
        >
          All interviews
        </Link>
      </div>

      <Report interview={interview} />
    </div>
  );
}
