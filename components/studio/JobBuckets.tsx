"use client";

import Link from "next/link";
import { useState } from "react";
import { StudioJobCard } from "@/components/studio/StudioJobCard";
import type { JobRow } from "@/lib/jobs/query";

export type Bucket = { key: string; label: string; total: number; jobs: JobRow[] };

/**
 * Recommended jobs, in buckets that are actually true.
 *
 * The design's tabs were Naukri's — Applies (8), Profile (74), Preferences (4).
 * The first of those describes applications we do not track, and the other two
 * are their recommendation model. Building tabs that count things the product
 * cannot count is how a dashboard ends up lying in four places at once.
 *
 * So the buckets are assembled on the server from what the profile really has:
 * every job, the ones in the cities they chose, the remote ones, and the ones
 * inside their years of experience. A bucket with nothing behind it — no
 * cities set, no experience given — is never sent here, which is why this
 * component renders whatever it is handed rather than deciding.
 */
export function JobBuckets({ buckets }: { buckets: Bucket[] }) {
  const [active, setActive] = useState(buckets[0]?.key ?? "");
  const shown = buckets.find((b) => b.key === active) ?? buckets[0];

  if (!shown) return null;

  return (
    <section className="rounded-2xl border border-ink-08 bg-paper">
      <div className="flex items-baseline justify-between gap-4 px-5 pt-5 sm:px-6">
        <h2 className="text-[0.97rem] font-semibold tracking-[-0.02em]">
          Recommended jobs for you
        </h2>
        <Link
          href="/studio/jobs"
          className="shrink-0 text-[0.8rem] font-medium text-sky-1 hover:underline"
        >
          View all
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Job buckets"
        className="mt-4 flex gap-6 overflow-x-auto border-b border-ink-08 px-5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {buckets.map((b) => (
          <button
            key={b.key}
            type="button"
            role="tab"
            aria-selected={b.key === active}
            onClick={() => setActive(b.key)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[0.84rem] transition-colors ${
              b.key === active
                ? "border-sky-1 font-medium text-ink"
                : "border-transparent text-ink-50 hover:text-ink"
            }`}
          >
            {b.label} ({b.total})
          </button>
        ))}
      </div>

      <div className="px-5 py-5 sm:px-6">
        {shown.jobs.length === 0 ? (
          <p className="py-6 text-[0.83rem] leading-relaxed text-ink-30">
            Nothing in this bucket yet. New roles land here as the boards we
            follow post them.
          </p>
        ) : (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {shown.jobs.map((job) => (
              <div key={job.id} className="w-[236px] shrink-0">
                <StudioJobCard job={job} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
