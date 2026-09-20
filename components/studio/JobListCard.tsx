import type { JobRow } from "@/lib/jobs/query";

/**
 * One job, as a full-width row.
 *
 * The studio has two job cards now and that is deliberate: StudioJobCard is
 * 236px wide and lives in the home carousel, where everything has to be
 * clamped. This one has the width to show the facts that actually decide a
 * click — where, how much experience, what it pays, how old it is — on one
 * line, the way a job board does.
 *
 * The whole row is a link to the company's own application page. There is no
 * detail page in between, on purpose: we did not write the posting, and a
 * copy of it on our domain is one more thing to keep in sync and one more
 * step between somebody and the job.
 */

export function JobListCard({ job }: { job: JobRow }) {
  const where = job.is_remote
    ? "Remote"
    : job.cities?.length
      ? job.cities.slice(0, 2).join(", ")
      : job.location_raw || "India";

  const years = experience(job);
  const pay = money(job);

  return (
    <a
      href={job.apply_url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group block rounded-2xl border border-ink-08 bg-paper p-5 transition-all hover:border-ink-30 hover:shadow-[0_2px_14px_-6px_rgb(0_0_0/0.12)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[1rem] font-semibold leading-snug tracking-[-0.02em] group-hover:underline">
            {job.title}
          </h3>
          <p className="mt-1 truncate text-[0.85rem] text-ink-50">
            {job.company}
            {job.department ? ` · ${job.department}` : ""}
          </p>
        </div>
        {job.posted_at && (
          <span className="shrink-0 text-[0.74rem] text-ink-30">{ago(job.posted_at)}</span>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.82rem] text-ink-70">
        <Fact icon={<PinIcon />}>{where}</Fact>
        {years && <Fact icon={<ClockIcon />}>{years}</Fact>}
        {/* No salary is the normal case on a public posting, so the fact is
            dropped rather than shown as "Not disclosed" on nine rows in ten. */}
        {pay && <Fact icon={<RupeeIcon />}>{pay}</Fact>}
        {job.employment_type && job.employment_type !== "full_time" && (
          <Fact icon={<TagIcon />}>{label(job.employment_type)}</Fact>
        )}
      </div>

      {job.skills.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 6).map((s) => (
            <span key={s} className="rounded-md bg-ink-04 px-2 py-0.5 text-[0.74rem] text-ink-50">
              {s}
            </span>
          ))}
          {job.skills.length > 6 && (
            <span className="self-center text-[0.74rem] text-ink-30">
              +{job.skills.length - 6}
            </span>
          )}
        </div>
      )}
    </a>
  );
}

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-ink-30">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ facts */

function experience(job: JobRow): string | null {
  const { years_min: lo, years_max: hi } = job;
  if (lo === null && hi === null) return null;
  if (lo !== null && hi !== null) return lo === hi ? `${lo} yrs` : `${lo}–${hi} yrs`;
  if (lo !== null) return `${lo}+ yrs`;
  return `Up to ${hi} yrs`;
}

/**
 * Pay, in the units people read it in.
 *
 * Indian postings are quoted in lakhs per year and nobody writes ₹1,800,000,
 * so anything annual and large enough is converted. A monthly figure stays
 * monthly — rewriting it as an annual number would be us doing arithmetic the
 * employer did not do.
 */
function money(job: JobRow): string | null {
  const { salary_min: lo, salary_max: hi, salary_currency: cur, salary_period: period } = job;
  if (lo === null && hi === null) return null;
  if (cur && cur !== "INR") return null;

  const unit = (n: number) =>
    period === "month"
      ? `₹${Math.round(n / 1000)}k`
      : n >= 100000
        ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`
        : `₹${Math.round(n / 1000)}k`;

  const tail = period === "month" ? "/mo" : " a year";
  if (lo !== null && hi !== null && lo !== hi) return `${unit(lo)}–${unit(hi)}${tail}`;
  return `${unit((lo ?? hi) as number)}${tail}`;
}

function label(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ------------------------------------------------------------------ icons */

const S = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-[15px]",
  "aria-hidden": true,
};

const PinIcon = () => (
  <svg {...S}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

const ClockIcon = () => (
  <svg {...S}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);

const RupeeIcon = () => (
  <svg {...S}>
    <path d="M7 5h10M7 9.5h10M7 5c4.5 0 6.5 1.6 6.5 4.2S11.5 13.5 7 13.5l7.5 5.5" />
  </svg>
);

const TagIcon = () => (
  <svg {...S}>
    <path d="M3.5 7.5v4.6c0 .5.2 1 .6 1.4l6.4 6.4a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8l-6.4-6.4a2 2 0 0 0-1.4-.6H5.5a2 2 0 0 0-2 2Z" />
    <circle cx="7.6" cy="7.6" r="1.1" />
  </svg>
);
