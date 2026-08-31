import Link from "next/link";
import { getProfile, isPaid } from "@/lib/app/account";
import { Card } from "@/components/app/ui";

const INCLUDED = [
  "Voice conversations with the agent",
  "Jobs ranked against your resume, with reasons",
  "Unlimited ATS checks and resume reads",
  "Priority on new features as they ship",
];

export default async function UpgradePage() {
  const profile = await getProfile();
  const paid = isPaid(profile);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">
        {paid ? "Your plan" : "Go Pro"}
      </h1>

      {paid ? (
        <div className="mt-8 max-w-lg">
          <Card title="Active">
            <p className="text-[0.95rem]">You are on Pro.</p>
            <p className="mt-2 text-[0.85rem] text-ink-50">
              {profile?.plan_expires_at
                ? `Renews ${new Date(profile.plan_expires_at).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })}.`
                : "No renewal date on file."}
            </p>
          </Card>
        </div>
      ) : (
        <>
          <p className="mt-2.5 max-w-[64ch] text-[0.92rem] leading-relaxed text-ink-50">
            The tools stay free. The agent and job matching are what the plan pays for — they cost
            real money to run on every use.
          </p>

          <div className="mt-8 max-w-lg">
            <Card>
              <ul className="space-y-3">
                {INCLUDED.map((line) => (
                  <li key={line} className="flex gap-3 text-[0.92rem] leading-relaxed">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-7 border-t border-ink-08 pt-6">
                <p className="text-[0.85rem] leading-relaxed text-ink-30">
                  Payments are not connected yet. Razorpay subscriptions with UPI Autopay come in
                  with the agent — there is no point charging before the thing being charged for
                  exists.
                </p>
                <Link
                  href="/app"
                  className="mt-5 inline-block rounded-full border border-ink-15 px-5 py-2.5 text-[0.85rem]"
                >
                  Back to your dashboard
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
