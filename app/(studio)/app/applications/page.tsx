import Link from "next/link";
import { listApplications, needsFollowUp } from "@/lib/jobs/applications";
import { ApplicationRow } from "@/components/studio/ApplicationRow";

export const dynamic = "force-dynamic";

/** Every job they prepared an application for, and where each one stands. */
export default async function ApplicationsPage() {
  const apps = await listApplications();
  const counts = {
    applied: apps.filter((a) => a.status === "applied").length,
    interview: apps.filter((a) => a.status === "interview").length,
    offer: apps.filter((a) => a.status === "offer").length,
  };

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">My applications</h1>
        <Link href="/app/jobs" className="text-[0.82rem] font-medium underline underline-offset-4">
          Find more jobs →
        </Link>
      </div>

      {apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-15 bg-paper p-8 text-center">
          <p className="text-[0.95rem] font-medium">No applications yet</p>
          <p className="mx-auto mt-2 max-w-[48ch] text-[0.85rem] leading-relaxed text-ink-50">
            Pick a job and tap <span className="font-medium text-ink">Prepare my application</span> — you get a
            tailored resume, a cover letter and ready answers, and it is tracked here.
          </p>
          <Link
            href="/app/jobs"
            className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper"
          >
            Browse jobs
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["Applied", counts.applied],
                ["Interviews", counts.interview],
                ["Offers", counts.offer],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-2xl border border-ink-08 bg-paper p-4">
                <p className="text-[1.4rem] font-semibold tabular-nums">{n}</p>
                <p className="text-[0.78rem] text-ink-50">{label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {apps.map((a) => (
              <ApplicationRow key={a.id} app={a} followUp={needsFollowUp(a)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
