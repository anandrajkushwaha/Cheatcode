import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, isPaid } from "@/lib/app/account";
import { getInterview } from "@/lib/interview/store";
import { Runner } from "@/components/studio/interview/Runner";

export const dynamic = "force-dynamic";

/**
 * One interview, in progress.
 *
 * A finished one redirects to its report rather than letting somebody answer
 * questions that have already been marked — the report would not change, and
 * re-marking is a second model call for nothing.
 */
export default async function InterviewRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/studio/interviews");

  const profile = await getProfile();
  const interview = await getInterview(id, user.id, isPaid(profile));
  if (!interview) notFound();

  if (interview.session.status === "done") {
    redirect(`/studio/interviews/${id}/feedback`);
  }

  return (
    <div className="py-2">
      <p className="mx-auto mb-6 max-w-[760px] text-[0.82rem] text-ink-50">
        {interview.session.topic}
        {interview.session.company ? ` · ${interview.session.company}` : ""}
      </p>
      <Runner sessionId={interview.session.id} questions={interview.questions} />
    </div>
  );
}
