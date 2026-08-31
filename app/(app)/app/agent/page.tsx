import { getProfile, getPrimaryResume, isPaid } from "@/lib/app/account";
import { Card, Empty, PaidOnly } from "@/components/app/ui";

export default async function AgentPage() {
  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Agent</h1>
      <p className="mt-2.5 max-w-[68ch] text-[0.92rem] leading-relaxed text-ink-50">
        Not built yet. This will be a voice conversation — it works out what you actually want,
        gives you honest feedback on your resume, and then explains which jobs fit and why.
        Typing will work too, for when a call is not convenient.
      </p>

      <div className="mt-8">
        <PaidOnly
          paid={isPaid(profile)}
          feature="A real conversation about your career, then jobs chosen off the back of it."
        >
          <Card>
            <Empty>
              {resume
                ? "Your resume is ready. The agent will read it before the first question."
                : "Add your resume first — the agent starts from it."}
            </Empty>
          </Card>
        </PaidOnly>
      </div>
    </>
  );
}
