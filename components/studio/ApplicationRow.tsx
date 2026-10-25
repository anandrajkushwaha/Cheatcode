"use client";

import Link from "next/link";
import { useState } from "react";
import type { Application, ApplicationStatus } from "@/lib/jobs/applications";

const LABELS: Record<ApplicationStatus, string> = {
  prepared: "Prepared",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/** One application in the tracker: what it is, where it stands, what to do next. */
export function ApplicationRow({ app, followUp }: { app: Application; followUp: boolean }) {
  const [status, setStatus] = useState<ApplicationStatus>(app.status);
  const [saving, setSaving] = useState(false);

  async function move(next: ApplicationStatus) {
    const prev = status;
    setStatus(next);
    setSaving(true);
    const res = await fetch(`/api/app/apply/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    if (!res?.ok) setStatus(prev);
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-ink-08 bg-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.98rem] font-semibold tracking-[-0.02em]">{app.title}</p>
          <p className="mt-0.5 text-[0.84rem] text-ink-50">
            {app.company}
            {app.match_score ? ` · ${app.match_score}% match` : ""}
            {app.applied_at ? ` · applied ${new Date(app.applied_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
          </p>
        </div>
        <select
          value={status}
          disabled={saving}
          onChange={(e) => void move(e.target.value as ApplicationStatus)}
          aria-label="Status"
          className="rounded-full border border-ink-15 bg-paper px-3 py-1.5 text-[0.82rem]"
        >
          {Object.entries(LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {followUp && status === "applied" && (
        <p className="mt-3 rounded-xl bg-[#fff8eb] px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-[#7a5200]">
          No reply for over 10 days. A short, polite follow-up email to the recruiter often gets one.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem]">
        {app.job_id && (
          <Link href={`/app/jobs/${app.job_id}/apply`} className="underline underline-offset-4">
            Open application pack
          </Link>
        )}
        {status === "interview" && (
          <Link href="/app/interviews" className="underline underline-offset-4">
            Practise with a mock interview
          </Link>
        )}
        {app.apply_url && (
          <a href={app.apply_url} target="_blank" rel="noopener noreferrer nofollow" className="text-ink-50 underline underline-offset-4">
            Company page ↗
          </a>
        )}
      </div>
    </div>
  );
}
