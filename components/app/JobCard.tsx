import type { JobRow } from "@/lib/jobs/query";

/**
 * One job, in the shape people already read on Naukri: title, company,
 * then the four facts that decide whether they click — where, how much
 * experience, what it pays, how old it is.
 *
 * The whole card is a link to the company's own application page. There is no
 * detail page in between on purpose: we did not write this posting, and a
 * copy of it on our domain would be one more thing to keep in sync and one
 * more step between someone and the job.
 */
export function JobCard({ job, delay = 0 }: { job: JobRow; delay?: number }) {
  return (
    <a
      href={job.apply_url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="cc-rise group block rounded-2xl border border-ink-08 bg-paper p-5 transition-colors hover:border-ink-30"
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[1rem] font-semibold leading-snug tracking-[-0.02em] group-hover:underline">
            {job.title}
          </h3>
          <p className="mt-1 text-[0.86rem] text-ink-50">
            {job.company}
            {job.department ? ` · ${job.department}` : ""}
          </p>
        </div>
        {job.posted_at && (
          <span className="shrink-0 text-[0.74rem] text-ink-30">{ago(job.posted_at)}</span>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.82rem] text-ink-70">
        <Fact icon={<IconPin />}>{place(job)}</Fact>
        {experience(job) && <Fact icon={<IconClock />}>{experience(job)}</Fact>}
        {money(job) && <Fact icon={<IconRupee />}>{money(job)}</Fact>}
        {job.employment_type && job.employment_type !== "full_time" && (
          <Fact icon={<IconTag />}>{label(job.employment_type)}</Fact>
        )}
      </div>

      {job.skills.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 6).map((s) => (
            <span
              key={s}
              className="rounded-md bg-ink-04 px-2 py-0.5 text-[0.74rem] text-ink-50"
            >
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

/* ------------------------------------------------------------------ bits */

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-ink-30">{icon}</span>
      {children}
    </span>
  );
}

function place(job: JobRow): string {
  if (job.cities.length) {
    const list = job.cities.slice(0, 2).join(", ");
    const more = job.cities.length > 2 ? ` +${job.cities.length - 2}` : "";
    return job.is_remote ? `${list}${more} · Remote ok` : `${list}${more}`;
  }
  if (job.is_remote) return "Remote";
  return job.location_raw ?? "India";
}

/**
 * Postgres numerics can arrive as strings depending on the driver, and "1.0+
 * yrs" is how that leaks into the interface. Coerced here rather than trusted.
 */
const num = (v: number | string | null): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function experience(job: JobRow): string | null {
  const min = num(job.years_min);
  const max = num(job.years_max);
  const { seniority } = job;
  if (min !== null && max !== null) return `${min}–${max} yrs`;
  if (min !== null) return min === 0 ? "Fresher ok" : `${min}+ yrs`;
  if (seniority === "intern") return "Internship";
  if (seniority === "junior") return "Entry level";
  if (seniority === "senior") return "Senior";
  if (seniority === "lead") return "Lead";
  return null;
}

/**
 * Indian salaries are read in lakhs, not in digits. ₹18,00,000 makes people
 * count zeroes; ₹18L does not.
 */
function money(job: JobRow): string | null {
  const min = num(job.salary_min);
  const max = num(job.salary_max);
  const cur = job.salary_currency;
  if (min === null && max === null) return null;

  if ((cur ?? "INR") === "INR") {
    const lakh = (n: number) => {
      const l = n / 100_000;
      return l >= 100 ? `${(l / 100).toFixed(l % 100 === 0 ? 0 : 1)}Cr` : `${trim(l)}L`;
    };
    if (min !== null && max !== null) return `₹${lakh(min)}–${lakh(max)}`;
    return `₹${lakh((min ?? max)!)}+`;
  }

  const k = (n: number) => `${Math.round(n / 1000)}K`;
  const symbol = cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "GBP" ? "£" : `${cur} `;
  if (min !== null && max !== null) return `${symbol}${k(min)}–${k(max)}`;
  return `${symbol}${k((min ?? max)!)}+`;
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function label(type: string): string {
  return type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return "";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}

/* ----------------------------------------------------------------- icons */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 17.5s5.5-4.9 5.5-9a5.5 5.5 0 1 0-11 0c0 4.1 5.5 9 5.5 9Z" {...stroke} />
      <circle cx="10" cy="8.4" r="2" {...stroke} />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" {...stroke} />
      <path d="M10 5.9V10l2.8 1.7" {...stroke} />
    </svg>
  );
}

function IconRupee() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6.5 4.5h7M6.5 7.6h7M11.6 4.6c1.6.3 2.6 1.5 2.6 3 0 1.8-1.5 3.1-3.6 3.1H6.5l6 4.8" {...stroke} />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 9.2V4.4a.9.9 0 0 1 .9-.9h4.8l7.3 7.3-5.7 5.7L3.5 9.2Z" {...stroke} />
      <circle cx="6.9" cy="6.9" r="1" {...stroke} />
    </svg>
  );
}
