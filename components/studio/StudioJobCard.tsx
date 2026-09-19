import type { JobRow } from "@/lib/jobs/query";

/**
 * A job, sized for the carousel.
 *
 * /app's JobCard is built for a full-width list: a one-line title, four facts
 * across, and six skill chips. Dropped into a 240px column it wrapped titles
 * to three lines and spilled chips onto a fourth row, and because the row's
 * height is set by the tallest card, every shorter card left a block of empty
 * white underneath it. That is the gap on the home screen.
 *
 * So this is the compact version: two lines of title, company, one line of
 * facts, three chips, and h-full so every card in the row is the same height
 * with the space inside the border rather than below it.
 */
export function StudioJobCard({ job }: { job: JobRow }) {
  const facts = [
    job.is_remote ? "Remote" : job.cities?.[0] ?? job.location_raw ?? null,
    typeof job.years_min === "number" ? `${job.years_min}+ yrs` : null,
  ].filter(Boolean) as string[];

  return (
    <a
      href={job.apply_url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group flex h-full flex-col rounded-xl border border-ink-08 bg-paper p-4 transition-colors hover:border-ink-30"
    >
      <p className="line-clamp-2 text-[0.86rem] font-semibold leading-snug tracking-[-0.01em] group-hover:underline">
        {job.title}
      </p>
      <p className="mt-1 truncate text-[0.78rem] text-ink-50">{job.company}</p>

      {facts.length > 0 && (
        <p className="mt-2.5 truncate text-[0.74rem] text-ink-70">{facts.join(" · ")}</p>
      )}

      {job.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-md bg-ink-04 px-1.5 py-0.5 text-[0.67rem] text-ink-50"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Pushes the age to the bottom so it lines up across cards of
          different content lengths. */}
      <span className="mt-auto pt-3 text-[0.68rem] text-ink-30">
        {job.posted_at ? ago(job.posted_at) : " "}
      </span>
    </a>
  );
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
