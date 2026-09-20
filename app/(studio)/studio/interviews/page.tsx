import Link from "next/link";
import { getProfile, getPrimaryResume, isPaid } from "@/lib/app/account";
import { getSessionUser } from "@/lib/supabase/app";
import { searchJobs } from "@/lib/jobs/query";
import { getHistory, countToday } from "@/lib/interview/store";
import {
  MOCK_REQUIRES_PRO,
  FREE_INTERVIEWS_PER_DAY,
  FALLBACK_TOPICS,
  QUESTIONS_PER_INTERVIEW,
} from "@/lib/interview/plan";
import { StartButton } from "@/components/studio/interview/StartButton";
import { LockedPanel } from "@/components/studio/interview/LockedPanel";

export const dynamic = "force-dynamic";

/**
 * Mock interviews.
 *
 * Three ways in, in the order they are worth: a role you are actually
 * applying for, a topic from your own profile, and — only if we know nothing
 * about you — a generic list.
 *
 * The job-based route is the one that makes this better than a question
 * website. The questions come from a real posting's title and required
 * skills, so it is preparation for a specific interview rather than revision.
 *
 * MOCK_REQUIRES_PRO is currently false: everything below is open, with a
 * daily cap, while the feature is being tested against real answers. Flipping
 * that one constant turns this into the paid screen.
 */

const WHEN = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

export default async function StudioInterviewsPage() {
  const [user, profile, resume] = await Promise.all([
    getSessionUser(),
    getProfile(),
    getPrimaryResume(),
  ]);

  const paid = isPaid(profile);
  const locked = MOCK_REQUIRES_PRO && !paid;

  // Topics: their target roles and their own strongest skills, because an
  // interview about "Figma" is only useful to somebody who put Figma on their
  // resume. The generic list is the fallback, not the default.
  const fromProfile = [
    ...(profile?.target_roles ?? []),
    profile?.current_title ?? "",
    ...(resume?.skills ?? []).slice(0, 6),
  ]
    .map((t) => t.trim())
    .filter(Boolean);

  const topics = Array.from(new Set(fromProfile)).slice(0, 8);
  const shown = topics.length >= 3 ? topics : FALLBACK_TOPICS;

  const cities = (profile?.preferred_cities ?? []).filter(Boolean);
  const [{ jobs }, history, usedToday] = await Promise.all([
    searchJobs({
      cities,
      maxYears: profile?.years_experience ?? null,
      limit: 6,
    }),
    user ? getHistory(user.id) : Promise.resolve([]),
    user && !paid ? countToday(user.id) : Promise.resolve(0),
  ]);

  const left = Math.max(0, FREE_INTERVIEWS_PER_DAY - usedToday);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Mock interviews</h1>
          <p className="mt-1.5 max-w-[60ch] text-[0.86rem] leading-relaxed text-ink-50">
            {QUESTIONS_PER_INTERVIEW} questions, written for the role you pick.
            Answer them, and you get a report on what to change — with the
            sentence of yours each note is about.
          </p>
        </div>
        {!paid && !locked && (
          <p className="text-[0.8rem] text-ink-30">
            {left > 0
              ? `${left} of ${FREE_INTERVIEWS_PER_DAY} left today`
              : "None left today"}
          </p>
        )}
      </div>

      {locked ? (
        <LockedPanel />
      ) : (
        <>
          {/* ------------------------------------------------- roles you want */}
          {jobs.length > 0 && (
            <section>
              <h2 className="text-[0.97rem] font-semibold tracking-[-0.02em]">
                Prepare for a role you could apply to
              </h2>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-50">
                Questions written from the posting itself — its title and the
                skills it asks for.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-col rounded-2xl border border-ink-08 bg-paper p-5"
                  >
                    <p className="line-clamp-2 text-[0.9rem] font-semibold leading-snug tracking-[-0.01em]">
                      {job.title}
                    </p>
                    <p className="mt-1 truncate text-[0.8rem] text-ink-50">{job.company}</p>
                    <p className="mt-2 text-[0.75rem] text-ink-30">
                      {QUESTIONS_PER_INTERVIEW} questions
                    </p>
                    <div className="mt-auto pt-4">
                      <StartButton
                        jobId={job.id}
                        kind="job"
                        className="text-[0.84rem] font-medium text-sky-1 hover:underline"
                      >
                        Start preparing →
                      </StartButton>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ------------------------------------------------------- topics */}
          <section>
            <h2 className="text-[0.97rem] font-semibold tracking-[-0.02em]">
              {topics.length >= 3 ? "Based on your profile" : "Start with the basics"}
            </h2>
            <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-50">
              {topics.length >= 3
                ? "Your target roles and the skills on your resume."
                : "Fill in your profile and these become the roles and skills you actually list."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {shown.map((topic) => (
                <StartButton
                  key={topic}
                  topic={topic}
                  kind="topic"
                  busyLabel="Writing…"
                  className="rounded-full border border-ink-15 bg-paper px-4 py-2 text-[0.84rem] transition-colors hover:border-ink-30"
                >
                  {topic}
                </StartButton>
              ))}
            </div>
          </section>

          {/* ------------------------------------------------------ history */}
          {history.length > 0 && (
            <section>
              <h2 className="text-[0.97rem] font-semibold tracking-[-0.02em]">Your interviews</h2>
              <ul className="mt-4 space-y-2.5">
                {history.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={
                        h.status === "done"
                          ? `/studio/interviews/${h.id}/feedback`
                          : `/studio/interviews/${h.id}`
                      }
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-08 bg-paper px-4 py-3 transition-colors hover:border-ink-30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[0.88rem] font-medium">
                          {h.topic}
                          {h.company ? ` · ${h.company}` : ""}
                        </span>
                        <span className="block text-[0.75rem] text-ink-30">
                          {h.startedAt ? WHEN.format(new Date(h.startedAt)) : ""}
                          {h.status === "running" ? " · unfinished" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-[0.8rem] text-ink-50">
                        {h.verdict ?? (h.status === "running" ? "Resume →" : "View →")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
