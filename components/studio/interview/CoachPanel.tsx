"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The banner on the report, and the conversation behind it.
 *
 * Text only. The agent's voice path exists and is the wrong tool for this —
 * somebody reading a report has it in front of them and wants to point at a
 * line, not hold a call about it. So there is no microphone here and no call
 * button, and nothing on this screen can start one.
 *
 * The banner has two states, and that is the whole design: before the first
 * message it invites, afterwards it shows what came out of the conversation
 * and offers to continue. Somebody opening this report a week later sees the
 * conclusion, not forty messages — and the thread is still there underneath
 * when they press.
 */

type Message = { role: "user" | "model"; text: string };

const OPENERS = [
  "How should I have answered the weakest one?",
  "Give me a stronger opening line",
  "What will they ask me next after that answer?",
];

export function CoachPanel({
  sessionId,
  summary,
  weakest,
}: {
  sessionId: string;
  summary: string | null;
  weakest: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ------------------------------------------------------------ banner */}
      <div className="rounded-2xl border border-ink-08 bg-paper p-5">
        {summary ? (
          <>
            <p className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.16em] text-ink-30">
              <ChatIcon />
              From your conversation
            </p>
            <p className="mt-3 text-[0.85rem] leading-relaxed text-ink-70">{summary}</p>
          </>
        ) : (
          <>
            <p className="text-[0.95rem] font-semibold tracking-[-0.02em]">
              Improve your weakest answer
            </p>
            <p className="mt-1.5 text-[0.83rem] leading-relaxed text-ink-50">
              {weakest
                ? `Your ${weakest} came out weakest. Talk it through and leave with the words to say instead.`
                : "Talk the report through and leave with the words to say instead."}
            </p>
          </>
        )}

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity hover:opacity-90"
          >
            {summary ? "Continue the conversation" : "Talk it through"}
          </button>
        </div>
      </div>

      {open && (
        <Conversation
          sessionId={sessionId}
          weakest={weakest}
          onClose={() => {
            setOpen(false);
            // The summary on the banner behind is now out of date.
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------ the thread */

function Conversation({
  sessionId,
  weakest,
  onClose,
}: {
  sessionId: string;
  weakest: string | null;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Pick up where they stopped, however long ago that was.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/app/interview/coach?session=${sessionId}`);
        const data = (await res.json()) as { ok?: boolean; messages?: Message[] };
        if (!cancelled && data.ok && data.messages) setMessages(data.messages);
      } catch {
        /* An empty thread is a usable starting point. */
      } finally {
        if (!cancelled) {
          setLoading(false);
          box.current?.focus();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setMessages((m) => [...m, { role: "user", text: message }]);
    setValue("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/app/interview/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
      });
      const data = (await res.json()) as { ok?: boolean; reply?: string; error?: string };
      if (!data.ok || !data.reply) {
        setError(data.error ?? "The coach could not answer that.");
        setBusy(false);
        return;
      }
      setMessages((m) => [...m, { role: "model", text: data.reply! }]);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Talk through your interview"
        onClick={(e) => e.stopPropagation()}
        className="flex h-[88dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-t-3xl border border-ink-08 bg-paper sm:h-[76dvh] sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ink-08 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[0.92rem] font-semibold tracking-[-0.02em]">
              Talk it through
            </p>
            <p className="truncate text-[0.76rem] text-ink-30">
              It has read your whole interview
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-30 transition-colors hover:bg-ink-04 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <p className="text-[0.85rem] text-ink-30">Opening…</p>
          ) : messages.length === 0 ? (
            <div>
              <p className="max-w-[44ch] text-[0.9rem] leading-relaxed text-ink-50">
                Ask about any answer you gave. It has the questions, what you
                said, and what the report concluded.
              </p>
              <div className="mt-5 space-y-2">
                {OPENERS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => void send(o)}
                    className="block w-full rounded-xl border border-ink-08 px-4 py-2.5 text-left text-[0.85rem] transition-colors hover:border-ink-30"
                  >
                    {o}
                  </button>
                ))}
                {weakest && (
                  <button
                    type="button"
                    onClick={() => void send(`Why was my ${weakest} weak, and what should I say instead?`)}
                    className="block w-full rounded-xl border border-ink-08 px-4 py-2.5 text-left text-[0.85rem] transition-colors hover:border-ink-30"
                  >
                    Why was my {weakest} weak?
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <p
                    className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[0.88rem] leading-relaxed ${
                      m.role === "user"
                        ? "bg-ink text-paper"
                        : "bg-ink-04 text-ink-70"
                    }`}
                  >
                    {m.text}
                  </p>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <p className="rounded-2xl bg-ink-04 px-4 py-2.5 text-[0.88rem] text-ink-30">
                    Thinking…
                  </p>
                </div>
              )}
            </div>
          )}
          <div ref={bottom} />
        </div>

        {error && (
          <p className="shrink-0 border-t border-ink-08 px-5 py-2.5 text-[0.8rem] text-red-600">
            {error}
          </p>
        )}

        <div className="shrink-0 border-t border-ink-08 p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-ink-15 bg-paper p-2 pl-3.5 transition-colors focus-within:border-ink-30">
            <textarea
              ref={box}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(value);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Ask about any answer…"
              className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[0.88rem] leading-relaxed outline-none placeholder:text-ink-30"
            />
            <button
              type="button"
              onClick={() => void send(value)}
              disabled={busy || !value.trim()}
              aria-label="Send"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-paper transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-[15px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="mt-2 px-1 text-[0.72rem] text-ink-30">
            Saved to this report as a short summary — not the whole conversation.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[13px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.4A8 8 0 1 1 20 12Z" />
    </svg>
  );
}
