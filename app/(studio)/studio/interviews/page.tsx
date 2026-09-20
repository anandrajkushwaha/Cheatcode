import Link from "next/link";
import { getProfile, getPrimaryResume, isPaid } from "@/lib/app/account";
import { getSessionUser } from "@/lib/supabase/app";
import { getHistory, countToday } from "@/lib/interview/store";
import { getTopicsForRole } from "@/lib/interview/topics";
import {
  MOCK_REQUIRES_PRO,
  FREE_INTERVIEWS_PER_DAY,
  QUESTIONS_PER_INTERVIEW,
} from "@/lib/interview/plan";
import { RolePicker } from "@/components/studio/interview/RolePicker";
import { RoleHeader } from "@/components/studio/interview/RoleHeader";
import { TopicGrid } from "@/components/studio/interview/TopicGrid";
import { LockedPanel } from "@/components/studio/interview/LockedPanel";
import { OrbMark } from "@/components/studio/OrbMark";

export const dynamic = "force-dynamic";

/**
 * Mock interviews.
 *
 * ------------------------------------------------------------ what changed
 *
 * This screen used to open with six job cards from the jobs feed, offered as
 * things to practise. The jobs query has never known anything about role — it
 * filters on city and years — so a graphic designer was shown six software
 * engineering postings under the heading "a role you could apply to". That is
 * a worse failure than asking, so the job section is gone and the screen asks
 * instead. Practising against a real posting is still the right idea and will
 * come back the day job matching can actually pick the right six.
 *
 * Now: the role is asked once, the topics under it are generated for that
 * role, and everything on the page is about that role until they change it.
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

  // What to offer as a one-press answer to "which role". Everything the
  // profile and the resume already know, in order of how likely it is to be
  // the one they mean.
  const suggestions = Array.from(
    new Set(
      [
        ...(profile?.target_roles ?? []),
        resume?.latest_title ?? "",
        profile?.current_title ?? "",
      ]
        .map((r) => r.trim())
        .filter((r) => r.length > 1),
    ),
  ).slice(0, 6);

  const role = profile?.interview_role?.trim() || null;
  const years = profile?.years_experience ?? null;
  // Both are needed before any question can be written, so a half-answered
  // setup sends them back to the picker rather than producing questions
  // pitched at nobody.
  const ready = Boolean(role) && years !== null;

  const [topics, history, usedToday] = await Promise.all([
    ready && role && user && !locked ? getTopicsForRole(role, user.id) : Promise.resolve([]),
    user ? getHistory(user.id) : Promise.resolve([]),
    user && !paid ? countToday(user.id) : Promise.resolve(0),
  ]);

  const left = Math.max(0, FREE_INTERVIEWS_PER_DAY - usedToday);

  return (
    <div className="space-y-7">
      {/* ------------------------------------------------------------ header */}
      <div className="overflow-hidden rounded-[20px] border border-ink-08 bg-paper">
        <div className="flex flex-wrap items-start justify-between gap-5 px-6 py-6 sm:px-8 sm:py-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <OrbMark className="size-6" />
              <h1 className="text-[1.45rem] font-semibold tracking-[-0.032em] sm:text-[1.6rem]">
                Mock interviews
              </h1>
            </div>
            {ready && role ? (
              <div className="mt-2">
                <RoleHeader role={role} years={years} suggestions={suggestions} />
              </div>
            ) : (
              <p className="mt-2 max-w-[54ch] text-[0.88rem] leading-relaxed text-ink-50">
                {QUESTIONS_PER_INTERVIEW} questions, a real answer from you, and
                a report on what to change.
              </p>
            )}
          </div>

          {!paid && !locked && ready && (
            <span className="shrink-0 rounded-full bg-ink-04 px-3 py-1.5 text-[0.76rem] text-ink-50">
              {left > 0 ? `${left} left today` : "None left today"}
            </span>
          )}
        </div>

        {/* Three lines that set expectations before anybody presses anything.
            Hidden once they have done one — by then they know. */}
        {history.length === 0 && (
          <div className="grid gap-px border-t border-ink-08 bg-ink-08 sm:grid-cols-3">
            <Step n="1" title="Pick a topic" detail="Questions are written for it, on the spot." />
            <Step n="2" title="Type or speak" detail={`${QUESTIONS_PER_INTERVIEW} questions, about five minutes.`} />
            <Step n="3" title="Get the report" detail="What to change, quoting your own answers." />
          </div>
        )}
      </div>

      {locked ? (
        <LockedPanel />
      ) : !ready || !role ? (
        <RolePicker current={role} currentYears={years} suggestions={suggestions} />
      ) : (
        <>
          {/* ------------------------------------------------------- topics */}
          <section>
            <h2 className="text-[0.97rem] font-semibold tracking-[-0.02em]">
              What do you want to practise?
            </h2>
            <p className="mt-1.5 text-[0.83rem] leading-relaxed text-ink-50">
              {topics.length > 0
                ? `The areas an interviewer actually probes for a ${role.toLowerCase()}.`
                : `Start a general interview for ${role.toLowerCase()} roles.`}
            </p>

            <div className="mt-4">
              <TopicGrid role={role} topics={topics} />
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
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-08 bg-paper px-5 py-3.5 transition-colors hover:border-ink-30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[0.89rem] font-medium">
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

function Step({ n, title, detail }: { n: string; title: string; detail: string }) {
  return (
    <div className="bg-paper px-6 py-5 sm:px-8">
      <span className="grid size-6 place-items-center rounded-full bg-ink text-[0.72rem] font-medium text-paper">
        {n}
      </span>
      <p className="mt-3 text-[0.88rem] font-medium">{title}</p>
      <p className="mt-1 text-[0.79rem] leading-relaxed text-ink-50">{detail}</p>
    </div>
  );
}
