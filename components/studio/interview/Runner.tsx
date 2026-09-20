"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { InterviewQuestion } from "@/lib/interview/types";

/**
 * The interview itself.
 *
 * One question on screen at a time, a box, and a button. There is no timer
 * counting down and no webcam: both are things that make a practice interview
 * feel like an exam, and the point of practising is to say the thing out loud
 * badly once before saying it to a person.
 *
 * ------------------------------------------------------------ what it saves
 *
 * Each answer is POSTed as they move on rather than all four at the end, so a
 * closed tab costs one answer instead of the whole session. How long they
 * took is recorded too — not to score, but because "you answered that in
 * eleven seconds" is a useful thing to be told.
 *
 * ---------------------------------------------------------- what it doesn't
 *
 * No per-question feedback, and that is deliberate rather than unfinished:
 * marking each answer as it arrives teaches somebody to write for the marker
 * and doubles the model calls. The report comes once, at the end, having seen
 * all four answers — which is also the only way it can say anything about how
 * they communicated across the whole interview.
 */

export function Runner({
  sessionId,
  questions,
}: {
  sessionId: string;
  questions: InterviewQuestion[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(() => {
    // Resume where they stopped: the first question with no answer.
    const next = questions.findIndex((q) => !(q.answer ?? "").trim());
    return next === -1 ? 0 : next;
  });
  const [value, setValue] = useState(questions[index]?.answer ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(Date.now());
  const box = useRef<HTMLTextAreaElement>(null);

  const question = questions[index];
  const last = index === questions.length - 1;

  useEffect(() => {
    started.current = Date.now();
    box.current?.focus();
  }, [index]);

  async function submit(skip: boolean) {
    if (busy || !question) return;
    setBusy(true);
    setError(null);

    const answer = skip ? "" : value.trim();
    const seconds = Math.round((Date.now() - started.current) / 1000);

    try {
      await fetch("/api/app/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, questionId: question.id, answer, seconds }),
      });
    } catch {
      // A failed save is not a reason to trap somebody on question two. The
      // report will simply have one fewer answer to mark.
    }

    if (!last) {
      const next = index + 1;
      setIndex(next);
      setValue(questions[next]?.answer ?? "");
      setBusy(false);
      return;
    }

    // Last question: mark it, which is the second model call and takes a few
    // seconds. The screen says so rather than hanging on a disabled button.
    try {
      const res = await fetch("/api/app/interview/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Could not write the report. Your answers are saved.");
        setBusy(false);
        return;
      }
      router.push(`/studio/interviews/${sessionId}/feedback`);
    } catch {
      setError("Could not reach the server. Your answers are saved — try again.");
      setBusy(false);
    }
  }

  if (!question) return null;

  const done = index / questions.length;

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="flex items-center gap-4">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-08">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-500"
            style={{ width: `${Math.max(4, done * 100)}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => router.push("/studio/interviews")}
          className="shrink-0 text-[0.8rem] text-ink-50 hover:text-ink"
        >
          Exit
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-ink-08 bg-paper p-6 sm:p-7">
        <p className="text-[0.78rem] text-ink-30">
          Question {index + 1} of {questions.length}
        </p>
        <h2 className="mt-2 text-[1.12rem] font-semibold leading-snug tracking-[-0.02em] sm:text-[1.25rem]">
          {question.question}
        </h2>
        <p className="mt-2.5 text-[0.78rem] text-ink-30">Testing: {question.skill}</p>

        <textarea
          ref={box}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd+Enter moves on, because this box is long enough that
            // reaching for the mouse every time is an annoyance.
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void submit(false);
            }
          }}
          rows={9}
          maxLength={6000}
          placeholder="Answer as you would out loud. Rough is fine — it is the thinking that gets marked, not the grammar."
          className="mt-5 w-full resize-y rounded-xl border border-ink-15 bg-paper p-4 text-[0.92rem] leading-relaxed outline-none transition-colors placeholder:text-ink-30 focus:border-ink-30"
        />

        <div className="mt-1.5 flex items-center justify-between gap-4">
          <span className="text-[0.72rem] text-ink-30">
            {value.trim() ? `${value.trim().split(/\s+/).length} words` : "Aim for 80–150 words"}
          </span>
          <span className="hidden text-[0.72rem] text-ink-30 sm:block">⌘ + Enter</span>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={busy || !value.trim()}
            className="rounded-full bg-ink px-6 py-2.5 text-[0.88rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy
              ? last
                ? "Marking your interview…"
                : "Saving…"
              : last
                ? "Finish and get feedback"
                : "Next question"}
          </button>

          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={busy}
            className="text-[0.82rem] text-ink-50 underline underline-offset-4 hover:text-ink disabled:opacity-40"
          >
            Skip this one
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-[0.76rem] leading-relaxed text-ink-30">
        Feedback comes once, at the end — so the report can look at how you
        answered across all {questions.length}, not just one at a time.
      </p>
    </div>
  );
}
