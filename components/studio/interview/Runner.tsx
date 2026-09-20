"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { InterviewQuestion } from "@/lib/interview/types";
import { dictationSupported, startDictation } from "@/lib/interview/dictation";

/**
 * The interview itself.
 *
 * One question on screen, a box, and a button. No countdown and no webcam:
 * both make a practice interview feel like an exam, and the point of
 * practising is to say the thing badly once before saying it to a person.
 *
 * ------------------------------------------------------------ speaking it
 *
 * Most people talk faster than they type and a good answer is a hundred and
 * fifty words, so the microphone is not a novelty here — it is how the
 * feature stops being homework. Settled text is appended to whatever is
 * already in the box; the recogniser's live guess is shown greyed after it
 * rather than written in, because it rewrites itself on almost every word and
 * putting it in the textarea makes the whole field twitch.
 *
 * ------------------------------------------------------------ what it saves
 *
 * Each answer is POSTed as they move on rather than all four at the end, so a
 * closed tab costs one answer instead of the session.
 *
 * ---------------------------------------------------------- what it doesn't
 *
 * No per-question feedback. Marking each answer as it arrives teaches people
 * to write for the marker and doubles the model calls; the report comes once,
 * having seen all four — which is the only way it can say anything about how
 * they came across across the whole interview.
 */

export function Runner({
  sessionId,
  topic,
  questions,
}: {
  sessionId: string;
  topic: string;
  questions: InterviewQuestion[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(() => {
    const next = questions.findIndex((q) => !(q.answer ?? "").trim());
    return next === -1 ? 0 : next;
  });
  const [value, setValue] = useState(questions[index]?.answer ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [interim, setInterim] = useState("");
  const [micNote, setMicNote] = useState<string | null>(null);
  const [canDictate, setCanDictate] = useState(false);
  const mic = useRef<{ stop: () => void } | null>(null);

  const started = useRef(Date.now());
  const box = useRef<HTMLTextAreaElement>(null);

  const question = questions[index];
  const last = index === questions.length - 1;

  useEffect(() => setCanDictate(dictationSupported()), []);

  useEffect(() => {
    started.current = Date.now();
    box.current?.focus();
  }, [index]);

  // Never leave the microphone open behind a navigation.
  useEffect(() => () => mic.current?.stop(), []);

  function stopMic() {
    mic.current?.stop();
    mic.current = null;
    setListening(false);
    setStarting(false);
    setInterim("");
  }

  async function toggleMic() {
    if (listening || starting) {
      stopMic();
      return;
    }
    setMicNote(null);
    // Optimistic: the permission prompt can take a moment and a dead button
    // in the meantime is what makes people press it twice.
    setStarting(true);
    const handle = await startDictation({
      onFinal: (text) => {
        setValue((v) => {
          const sep = v && !/\s$/.test(v) ? " " : "";
          return (v + sep + text.trim()).trimStart();
        });
        setInterim("");
      },
      onInterim: setInterim,
      onError: (message) => {
        setMicNote(message);
        stopMic();
      },
      onEnd: () => {
        setListening(false);
        setInterim("");
      },
    });

    setStarting(false);
    // startDictation reports its own reason through onError, so a null here
    // needs no second message.
    if (!handle) return;
    mic.current = handle;
    setListening(true);
  }

  async function submit(skip: boolean) {
    if (busy || !question) return;
    stopMic();
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
      // A failed save is not a reason to trap somebody on question two.
    }

    if (!last) {
      const next = index + 1;
      setIndex(next);
      setValue(questions[next]?.answer ?? "");
      setBusy(false);
      return;
    }

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

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto max-w-[780px]">
      {/* ------------------------------------------------------------ chrome */}
      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-1.5">
          {questions.map((q, i) => (
            <span
              key={q.id}
              className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                i < index ? "bg-ink" : i === index ? "bg-ink/40" : "bg-ink-08"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            stopMic();
            router.push("/studio/interviews");
          }}
          className="shrink-0 text-[0.8rem] text-ink-50 transition-colors hover:text-ink"
        >
          Exit
        </button>
      </div>

      <p className="mt-4 text-[0.78rem] text-ink-30">
        {topic} · question {index + 1} of {questions.length}
      </p>

      {/* ---------------------------------------------------------- question */}
      <div className="mt-3 overflow-hidden rounded-[20px] border border-ink-08 bg-paper">
        <div className="border-b border-ink-08 px-6 py-6 sm:px-8">
          <h2 className="text-[1.18rem] font-semibold leading-snug tracking-[-0.025em] sm:text-[1.32rem]">
            {question.question}
          </h2>
          <p className="mt-2.5 inline-block rounded-full bg-ink-04 px-2.5 py-1 text-[0.72rem] text-ink-50">
            {question.skill}
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <div
            className={`rounded-2xl border bg-paper transition-colors ${
              listening || starting ? "border-ink-30 ring-4 ring-ink-04" : "border-ink-15"
            }`}
          >
            <textarea
              ref={box}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void submit(false);
                }
              }}
              rows={8}
              maxLength={6000}
              placeholder="Answer as you would out loud. Rough is fine — it is the thinking that gets marked, not the grammar."
              className="w-full resize-y bg-transparent p-4 text-[0.94rem] leading-relaxed outline-none placeholder:text-ink-30"
            />

            {/* The recogniser's current guess. Shown under the box rather than
                written into it, because it rewrites itself constantly. */}
            {(listening || starting) && (
              <p className="px-4 pb-3 text-[0.9rem] leading-relaxed text-ink-30">
                {interim || (starting ? "Waiting for the microphone…" : "Listening — just talk.")}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-08 px-3 py-2.5">
              <div className="flex items-center gap-2">
                {canDictate ? (
                  <button
                    type="button"
                    onClick={() => void toggleMic()}
                    disabled={busy}
                    aria-pressed={listening}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.8rem] font-medium transition-colors disabled:opacity-40 ${
                      listening
                        ? "bg-ink text-paper"
                        : "border border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
                    }`}
                  >
                    <MicIcon active={listening} />
                    {starting ? "Starting…" : listening ? "Stop" : "Speak your answer"}
                  </button>
                ) : (
                  <span className="px-1 text-[0.74rem] text-ink-30">
                    Dictation needs Chrome, Edge or Safari
                  </span>
                )}
              </div>

              <span className="px-1 text-[0.74rem] tabular-nums text-ink-30">
                {words ? `${words} words` : "Aim for 80–150 words"}
              </span>
            </div>
          </div>

          {micNote && (
            <p className="mt-3 text-[0.8rem] leading-relaxed text-ink-50">{micNote}</p>
          )}

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
              className="text-[0.82rem] text-ink-50 underline underline-offset-4 transition-colors hover:text-ink disabled:opacity-40"
            >
              Skip this one
            </button>

            <span className="ml-auto hidden text-[0.74rem] text-ink-30 sm:block">⌘ + Enter</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[0.76rem] leading-relaxed text-ink-30">
        Feedback comes once, at the end — so the report can look at all{" "}
        {questions.length} answers together, not one at a time.
      </p>
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex">
      {active && (
        <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-paper/30" />
      )}
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="relative size-[15px]"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
      </svg>
    </span>
  );
}
