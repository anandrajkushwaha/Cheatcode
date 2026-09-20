import Link from "next/link";
import type { FullInterview } from "@/lib/interview/store";
import type { FeedbackArea } from "@/lib/interview/types";

/**
 * The report.
 *
 * Two columns: where you stand, and what to change. The left is a verdict in
 * words and a rating per area; the right is the questions again, each with
 * the two things to fix and — this is the part that matters — the sentence of
 * yours each one is about.
 *
 * That quote is the whole design. Feedback that says "add a metric" is advice
 * anybody could have written before you opened your mouth. Feedback that says
 * "add a metric" underneath the exact sentence where you did not is about
 * your interview, and people act on it.
 *
 * There is no score out of a hundred anywhere, deliberately — see the comment
 * at the top of 80_interviews.sql.
 */

const TONE: Record<FeedbackArea["rating"], string> = {
  Excellent: "text-emerald-700",
  Good: "text-amber-600",
  "Needs work": "text-red-600",
};

const BAR: Record<FeedbackArea["rating"], string> = {
  Excellent: "w-full bg-emerald-600",
  Good: "w-2/3 bg-amber-500",
  "Needs work": "w-1/3 bg-red-500",
};

export function Report({
  interview,
  canSeeModelAnswers,
}: {
  interview: FullInterview;
  canSeeModelAnswers: boolean;
}) {
  const { session, questions, feedback } = interview;
  if (!feedback) return null;

  const tipsFor = (position: number) => feedback.tips.filter((t) => t.position === position);

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* ----------------------------------------------------- where you are */}
      <aside className="lg:sticky lg:top-[84px] lg:self-start">
        <div className="rounded-2xl border border-ink-08 bg-paper p-6">
          <Gauge areas={feedback.areas} verdict={feedback.verdict} />

          {feedback.headline && (
            <p className="mt-4 text-center text-[0.87rem] leading-relaxed text-ink-50">
              {feedback.headline}
            </p>
          )}

          <div className="mt-6 space-y-5">
            {feedback.areas.map((area, i) => (
              <div key={`${area.skill}-${i}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.85rem] font-medium capitalize">{area.skill}</p>
                  <span className={`shrink-0 text-[0.78rem] font-medium ${TONE[area.rating]}`}>
                    {area.rating}
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-ink-08">
                  <div className={`h-full rounded-full ${BAR[area.rating]}`} />
                </div>
                <p className="mt-2 text-[0.8rem] leading-relaxed text-ink-50">{area.note}</p>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/studio/interviews"
          className="mt-4 flex items-center justify-center rounded-full border border-ink-15 bg-paper px-5 py-2.5 text-[0.85rem] transition-colors hover:border-ink-30"
        >
          Practise another
        </Link>
      </aside>

      {/* -------------------------------------------------- what to change */}
      <div className="min-w-0 space-y-4">
        {questions.map((q) => {
          const tips = tipsFor(q.position);
          return (
            <section key={q.id} className="rounded-2xl border border-ink-08 bg-paper p-6">
              <p className="text-[0.78rem] font-medium text-ink-30">Q{q.position}</p>
              <h3 className="mt-1.5 text-[1rem] font-semibold leading-snug tracking-[-0.02em]">
                {q.question}
              </h3>

              {q.answer?.trim() ? (
                <details className="group mt-3">
                  <summary className="cursor-pointer list-none text-[0.8rem] text-ink-50 underline underline-offset-4 hover:text-ink">
                    Your answer
                  </summary>
                  <p className="mt-2.5 whitespace-pre-line rounded-xl bg-ink-04 p-4 text-[0.85rem] leading-relaxed text-ink-70">
                    {q.answer}
                  </p>
                </details>
              ) : (
                <p className="mt-3 text-[0.82rem] text-ink-30">You skipped this one.</p>
              )}

              {tips.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {tips.map((tip, i) => (
                    <div key={i} className="rounded-xl border border-ink-08 p-4">
                      <p className="inline-block rounded-md bg-ink-04 px-2 py-0.5 text-[0.7rem] font-medium text-ink-50">
                        Tip {i + 1}
                      </p>
                      <p className="mt-2.5 text-[0.85rem] leading-relaxed">{tip.tip}</p>
                      {/* The sentence the tip is about. Dropped rather than
                          faked when the model could not find one. */}
                      {tip.quote && (
                        <blockquote className="mt-3 border-l-2 border-ink-15 pl-3 text-[0.8rem] italic leading-relaxed text-ink-50">
                          {tip.quote}
                        </blockquote>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 border-t border-ink-08 pt-4">
                {canSeeModelAnswers && q.modelAnswer ? (
                  <details>
                    <summary className="cursor-pointer list-none text-[0.82rem] font-medium text-ink underline underline-offset-4">
                      How a strong candidate would answer
                    </summary>
                    <p className="mt-3 whitespace-pre-line text-[0.85rem] leading-relaxed text-ink-70">
                      {q.modelAnswer}
                    </p>
                  </details>
                ) : (
                  <Link
                    href="/studio/upgrade?from=interview-report"
                    className="inline-flex items-center gap-2 text-[0.82rem] font-medium text-ink-50 transition-colors hover:text-ink"
                  >
                    <LockIcon />
                    See how a strong candidate would answer
                  </Link>
                )}
              </div>
            </section>
          );
        })}

        <p className="px-1 pt-2 text-[0.78rem] leading-relaxed text-ink-30">
          Practised {session.topic}
          {session.company ? ` · ${session.company}` : ""}. This report stays in
          your history, so you can come back and see whether the same thing
          comes up twice.
        </p>
      </div>
    </div>
  );
}

/**
 * The arc.
 *
 * It is drawn from the ratings that are already on the page rather than from
 * a score, because there is no score — see 80_interviews.sql. Excellent
 * counts one, Good two thirds, Needs work one third, and the arc is their
 * average. That makes it an honest summary of the rows underneath it rather
 * than a second, different judgement.
 *
 * The number itself is never shown. The arc gives the glance; the words give
 * the meaning.
 */
function Gauge({ areas, verdict }: { areas: FeedbackArea[]; verdict: string }) {
  const WEIGHT: Record<FeedbackArea["rating"], number> = {
    Excellent: 1,
    Good: 0.66,
    "Needs work": 0.33,
  };

  const share = areas.length
    ? areas.reduce((sum, a) => sum + WEIGHT[a.rating], 0) / areas.length
    : 0.5;

  // A 240-degree arc, drawn as a stroked circle with a dash offset.
  const R = 52;
  const CIRC = 2 * Math.PI * R;
  const SWEEP = CIRC * (240 / 360);

  const tone =
    share > 0.82 ? "stroke-emerald-600" : share > 0.55 ? "stroke-amber-500" : "stroke-red-500";

  return (
    <div className="relative mx-auto w-[168px]">
      <svg viewBox="0 0 140 140" className="w-full" aria-hidden>
        <g transform="rotate(150 70 70)">
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            className="stroke-ink-08"
            strokeDasharray={`${SWEEP} ${CIRC}`}
          />
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            className={tone}
            strokeDasharray={`${SWEEP * share} ${CIRC}`}
          />
        </g>
      </svg>

      <div className="absolute inset-0 grid place-items-center px-6">
        <p className="text-center text-[1.15rem] font-semibold leading-tight tracking-[-0.03em]">
          {verdict}
        </p>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[14px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </svg>
  );
}
