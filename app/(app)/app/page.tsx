import Link from "next/link";
import {
  getProfile,
  getPrimaryResume,
  isPaid,
  profileGaps,
  profileStrength,
  hasIntent,
} from "@/lib/app/account";
import { searchJobs } from "@/lib/jobs/query";
import { JobCard } from "@/components/app/JobCard";
import { AgentHero } from "@/components/app/AgentHero";
import { ProfileCard } from "@/components/app/ProfileCard";
import {
  JobCardSkeleton,
  SectionHead,
  Soon,
} from "@/components/app/ui";

const STEPS = [
  {
    title: "Official sources",
    detail: "Company job boards and public APIs — not scraped listings.",
  },
  {
    title: "Scored against you",
    detail: "Your skills, years, cities and salary, not just keywords.",
  },
  {
    title: "With the reason",
    detail: "Why each one fits, so you can disagree with it.",
  },
];

/**
 * Home.
 *
 * Three columns, the way every job site in this market is laid out, because
 * that is the shape people already know how to read: who you are on the left,
 * what to do in the middle, what is happening on the right. What is different
 * is the top — the agent gets the first screen, and the columns are the
 * evidence behind whatever it just said.
 *
 * The centre column is deliberately drawn for jobs that do not exist yet.
 * Blank space would read as an unfinished product; an outline shows what is
 * arriving, and the label next to it is honest about when.
 */
export default async function AppHome() {
  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);

  // Three jobs, filtered by what the profile already says. Not ranked — that
  // is what the paid plan will do — so the heading below says "for you" and
  // the line under it says exactly which filters produced them.
  const { jobs: preview } = await searchJobs({
    cities: (profile?.preferred_cities ?? []).slice(0, 4),
    remote: profile?.open_to_remote && !profile?.preferred_cities?.length ? true : undefined,
    maxYears: profile?.years_experience ?? null,
    limit: 3,
  }).catch(() => ({ jobs: [] as never[] }));

  const paid = isPaid(profile);
  const gaps = profileGaps(profile, resume);
  const strength = profileStrength(profile, resume);
  const knowsWhatTheyWant = hasIntent(profile);

  const firstName = profile?.full_name?.split(" ")[0]?.trim();
  // IST, because that is where the audience is. Not worth a timezone library.
  const istHour = (new Date().getUTCHours() + 5) % 24;
  const partOfDay = istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";
  const greeting = firstName ? `${partOfDay}, ${firstName}` : partOfDay;

  const line = !resume
    ? "Start with your resume — everything here is built on it."
    : !knowsWhatTheyWant
      ? "Tell me what you're looking for, in one line."
      : "Tell me anything that's changed and I'll keep your matches honest.";

  const resumeAlert = !resume
    ? {
        title: "Add your resume",
        detail: "It is what your ATS score and every match on this page is built from.",
        action: "Upload",
      }
    : resume.parse_error
      ? {
          title: "We saved your resume but could not read it",
          detail: "Matching needs the details out of it. Try exporting a real PDF.",
          action: "Fix",
        }
      : (resume.ats_score ?? 100) < 60
        ? {
            title: `Your resume scores ${resume.ats_score} out of 100`,
            detail: "Below 60, an applicant tracking system is likely to drop it before a person looks.",
            action: "See why",
          }
        : null;


  return (
    <>
      <AgentHero greeting={greeting} line={line} gaps={gaps} hasIntent={knowsWhatTheyWant} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_272px]">
        {/* ------------------------------------------------------- left rail */}
        <aside
          className="cc-rise min-w-0 lg:sticky lg:top-20 lg:self-start"
          style={{ "--d": "60ms" } as React.CSSProperties}
        >
          <ProfileCard
            profile={profile}
            resume={resume}
            strength={strength}
            nextStep={gaps[0]?.label.toLowerCase() ?? null}
          />
        </aside>

        {/* ---------------------------------------------------------- centre */}
        <div className="cc-rise min-w-0 space-y-6" style={{ "--d": "120ms" } as React.CSSProperties}>
          {/* Only when something is actually wrong with it. A full resume card
              on every visit repeated the left rail and took the best slot on
              the page from the thing home is supposed to be about. */}
          {resumeAlert && (
            <Link
              href="/app/resume"
              className="cc-surface flex items-center gap-4 rounded-2xl border border-ink-08 p-4 transition-colors hover:border-ink-30 sm:p-5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-04 text-ink-50">
                <IconAlert />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.92rem] font-medium">{resumeAlert.title}</span>
                <span className="mt-0.5 block text-[0.83rem] leading-relaxed text-ink-50">
                  {resumeAlert.detail}
                </span>
              </span>
              <span className="shrink-0 text-[0.82rem] text-ink-30">{resumeAlert.action}</span>
            </Link>
          )}

          <section className="cc-surface rounded-2xl border border-ink-08 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHead
                title={preview.length ? "Jobs for you" : "Matched for you"}
                note={
                  preview.length
                    ? "Filtered by your cities and experience. Ranking comes with the plan."
                    : knowsWhatTheyWant
                      ? "As soon as a board carries something that fits, it lands here."
                      : "Tell the agent what you want and these fill in first."
                }
                action={preview.length ? { label: "See all", href: "/app/jobs" } : undefined}
              />
              {preview.length === 0 && <Soon>Building now</Soon>}
            </div>

            <div className="mt-5 grid gap-3">
              {preview.length > 0
                ? preview.map((job, i) => <JobCard key={job.id} job={job} delay={i * 70} />)
                : [0, 90, 180].map((d) => <JobCardSkeleton key={d} delay={d} />)}
            </div>

            <ol className="mt-5 grid gap-4 border-t border-ink-08 pt-5 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="text-[0.7rem] font-medium tabular-nums text-ink-30">
                    0{i + 1}
                  </span>
                  <p className="mt-1.5 text-[0.86rem] font-medium">{step.title}</p>
                  <p className="mt-1 text-[0.79rem] leading-relaxed text-ink-30">{step.detail}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* ------------------------------------------------------ right rail */}
        <aside
          className="cc-rise min-w-0 space-y-4 xl:sticky xl:top-20 xl:self-start"
          style={{ "--d": "180ms" } as React.CSSProperties}
        >
          <div className="cc-recess rounded-2xl border border-ink-08 p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.14em] text-ink-30">
              What is switched on
            </p>
            <ul className="mt-4 space-y-3">
              {[
                { label: "Your account", state: "on" as const },
                { label: "Resume and ATS score", state: resume ? ("on" as const) : ("todo" as const) },
                {
                  label: "What you're looking for",
                  state: knowsWhatTheyWant ? ("on" as const) : ("todo" as const),
                },
                { label: "Job matching", state: "soon" as const },
                { label: "Voice agent", state: "soon" as const },
              ].map((i) => (
                <li key={i.label} className="flex items-center justify-between gap-3">
                  <span
                    className={`text-[0.85rem] ${i.state === "soon" ? "text-ink-30" : "text-ink-70"}`}
                  >
                    {i.label}
                  </span>
                  <StateMark state={i.state} />
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`rounded-2xl border p-5 ${
              paid ? "cc-premium-surface" : "cc-recess border-ink-08"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p
                className={`text-[0.72rem] uppercase tracking-[0.14em] ${
                  paid ? "text-paper/55" : "text-ink-30"
                }`}
              >
                Plan
              </p>
              <span
                className={`text-[0.85rem] font-semibold ${paid ? "text-paper" : "text-ink-70"}`}
              >
                {paid ? "Pro" : "Free"}
              </span>
            </div>
            <p
              className={`mt-3 text-[0.8rem] leading-relaxed ${
                paid ? "text-paper/75" : "text-ink-50"
              }`}
            >
              {paid
                ? "Everything is on. Matching and the agent switch on for you the day they ship."
                : "Free covers your resume and ATS score. Matching and the voice agent are paid."}
            </p>
            {!paid && (
              <Link
                href="/app/upgrade"
                className="btn-premium mt-4 block rounded-xl py-2 text-center text-[0.82rem] font-semibold"
              >
                See the plan
              </Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

/** Three states, no colour: filled, hollow, dashed. */
function StateMark({ state }: { state: "on" | "todo" | "soon" }) {
  if (state === "on") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-label="done" className="shrink-0">
        <circle cx="7" cy="7" r="6.5" fill="var(--color-ink)" />
        <path
          d="M4 7.2l2 2L10 5"
          fill="none"
          stroke="var(--color-paper)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (state === "todo") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-label="to do" className="shrink-0">
        <circle cx="7" cy="7" r="6" fill="none" stroke="var(--color-ink-30)" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-label="coming soon" className="shrink-0">
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="var(--color-ink-15)"
        strokeWidth="1.4"
        strokeDasharray="2.4 2.4"
      />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6.4v4.2M10 13.4v.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
