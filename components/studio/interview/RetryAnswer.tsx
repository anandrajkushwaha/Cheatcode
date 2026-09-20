"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dictationSupported, startDictation, type Dictation } from "@/lib/interview/dictation";

/**
 * Answer this one again.
 *
 * Collapsed by default: the report is for reading first, and a textarea open
 * under every question turns it into a form. It opens on a press, pre-filled
 * with nothing — retyping the answer from memory is part of the exercise, and
 * pre-filling the old one produces edits rather than a second attempt.
 *
 * The same dictation as the interview itself, because the reason people talk
 * rather than type does not change between the two screens.
 */
export function RetryAnswer({
  sessionId,
  questionId,
  attempts,
}: {
  sessionId: string;
  questionId: number;
  attempts: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [interim, setInterim] = useState("");
  const [canDictate, setCanDictate] = useState(false);
  const mic = useRef<Dictation | null>(null);

  useEffect(() => setCanDictate(dictationSupported()), []);
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
        setError(message);
        stopMic();
      },
      onEnd: () => {
        setListening(false);
        setInterim("");
      },
    });
    setStarting(false);
    if (!handle) return;
    mic.current = handle;
    setListening(true);
  }

  async function submit() {
    stopMic();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/app/interview/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, questionId, answer: value.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Could not mark that.");
        setBusy(false);
        return;
      }
      setOpen(false);
      setValue("");
      setBusy(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-ink-50 transition-colors hover:text-ink"
      >
        <RetryIcon />
        {attempts > 1 ? `Try again (attempt ${attempts + 1})` : "Answer this again"}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-ink-15 bg-paper p-3.5">
      <p className="text-[0.8rem] font-medium">
        Say it again, better. Do not copy the rewrite — use your own words.
      </p>

      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        maxLength={6000}
        placeholder="Your second attempt…"
        className="mt-3 w-full resize-y rounded-lg border border-ink-15 bg-paper p-3 text-[0.88rem] leading-relaxed outline-none transition-colors placeholder:text-ink-30 focus:border-ink-30"
      />

      {(listening || starting) && (
        <p className="mt-1.5 text-[0.84rem] leading-relaxed text-ink-30">
          {interim || (starting ? "Waiting for the microphone…" : "Listening — just talk.")}
        </p>
      )}

      {error && <p className="mt-2.5 text-[0.8rem] leading-relaxed text-red-600">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || value.trim().length < 20}
          className="rounded-full bg-ink px-4 py-2 text-[0.82rem] font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Marking…" : "Mark this attempt"}
        </button>

        {canDictate && (
          <button
            type="button"
            onClick={() => void toggleMic()}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.79rem] font-medium transition-colors disabled:opacity-40 ${
              listening
                ? "bg-ink text-paper"
                : "border border-ink-15 text-ink-50 hover:border-ink-30 hover:text-ink"
            }`}
          >
            {starting ? "Starting…" : listening ? "Stop" : "Speak"}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            stopMic();
            setOpen(false);
            setError(null);
          }}
          disabled={busy}
          className="text-[0.8rem] text-ink-50 underline underline-offset-4 hover:text-ink disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RetryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[14px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11a8 8 0 1 0-2.1 6.1" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}
