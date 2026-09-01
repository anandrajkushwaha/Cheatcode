"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnimationItem, LottiePlayer } from "lottie-web";

/**
 * The agent, full screen.
 *
 * Opening it is a circle growing out of the orb rather than a new page: the
 * app is swallowed by the thing you pressed, which is why the reveal's origin
 * is passed in from wherever the orb happens to be.
 *
 * Two ways in, both real today. Typing goes to Gemini, grounded in this
 * person's profile, resume and open jobs. Speaking uses the browser's own
 * speech recognition and speaks the answer back — that is not the Gemini Live
 * agent, which is still to come, and the screen says so rather than implying
 * a capability that is weeks away.
 *
 * Paper, not a dark room. An immersive black surface was the obvious way to
 * make a full screen feel like a different mode, and it was wrong: the brand
 * is monochrome on white everywhere else, and one screen that ignores that
 * reads as a different product. The mode change is carried by the reveal and
 * by the size of the orb instead.
 */

type Turn = { role: "user" | "model"; text: string };

const OPENERS = [
  "Which of these jobs actually fit me?",
  "What's wrong with my resume?",
  "I want to switch to backend roles",
  "Am I asking for too much salary?",
];

export function AgentOverlay({
  origin,
  onClose,
}: {
  origin: { x: number; y: number };
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [speakBack, setSpeakBack] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech();

  /* ------------------------------------------------------------- closing */

  const close = useCallback(() => {
    speech.stop();
    window.speechSynthesis?.cancel();
    setClosing(true);
    // Long enough for the conceal animation; the state is thrown away after.
    window.setTimeout(onClose, 380);
  }, [onClose, speech]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);

    // The page behind must not scroll under a full-screen surface.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = window.setTimeout(() => inputRef.current?.focus(), 420);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(t);
      window.speechSynthesis?.cancel();
    };
  }, [close]);

  // Keep the newest exchange in view without yanking the page.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  // A finished dictation is a sent message: making somebody stop talking and
  // then press a button is the part that makes voice feel worse than typing.
  useEffect(() => {
    if (speech.final) void send(speech.final);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.final]);

  /* -------------------------------------------------------------- asking */

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    const next: Turn[] = [...turns, { role: "user", text: message }];
    setTurns(next);
    setValue("");
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/app/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: next }),
      });
      const json = (await res.json()) as { ok?: boolean; reply?: string; error?: string };

      if (!res.ok || !json.ok || !json.reply) {
        setError(json.error ?? "That didn't go through.");
        return;
      }

      setTurns([...next, { role: "model", text: json.reply }]);
      if (speakBack) speak(json.reply);
    } catch {
      setError("Network trouble. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const listening = speech.listening;

  // How far the circle has to travel to swallow the screen, measured rather
  // than guessed. The CSS fallback of 160vmax is nearly half as much again as
  // the furthest corner ever is, so an eased animation spent most of its
  // duration growing a circle that had already covered everything — the
  // reveal was over in about 200ms of its 620. This makes the end of the
  // animation the moment the screen is actually covered.
  const radius = useMemo(() => {
    if (typeof window === "undefined") return 1600;
    const dx = Math.max(origin.x, window.innerWidth - origin.x);
    const dy = Math.max(origin.y, window.innerHeight - origin.y);
    return Math.ceil(Math.hypot(dx, dy)) + 2;
  }, [origin.x, origin.y]);

  return (
    <>
      {/* A white circle opening over a white page is invisible — the only
          thing that reads is content disappearing, which looks like a bug.
          One flat ink scrim behind the surface gives the reveal an edge to
          travel across. It is not decoration: without it the animation has
          nothing to show. */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[59] bg-ink/25 ${closing ? "cc-fade-out" : "cc-fade-in"}`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cheatcode agent"
        className={`fixed inset-0 z-[60] overflow-hidden bg-paper text-ink ${
          closing ? "cc-conceal" : "cc-reveal"
        }`}
        style={
          {
            "--ox": `${origin.x}px`,
            "--oy": `${origin.y}px`,
            "--r": `${radius}px`,
          } as React.CSSProperties
        }
      >
        {/* ----------------------------------------------------------- close */}
        <button
          type="button"
          onClick={close}
          aria-label="Close the agent"
          className="cc-lift absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full border border-ink-15 text-ink-50 transition-colors hover:border-ink-30 hover:text-ink sm:right-7 sm:top-7"
          style={{ "--d": "320ms" } as React.CSSProperties}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        {/* ------------------------------------------------------------ body */}
        <div className="relative mx-auto flex h-full max-w-2xl flex-col px-5 sm:px-7">
          {/* orb — centred while the screen is still a question, pinned to the
              top once there is a conversation to read underneath it */}
          <div
            className={`cc-lift flex flex-col items-center ${
              turns.length === 0 ? "flex-1 justify-center pb-4" : "shrink-0 pt-[7vh]"
            }`}
            style={{ "--d": "180ms" } as React.CSSProperties}
          >
            <BigOrb listening={listening} busy={busy} />

            {turns.length === 0 && (
              <>
                <h2 className="mt-7 text-center text-[1.35rem] font-semibold leading-snug tracking-[-0.03em] sm:text-[1.6rem]">
                  {listening ? "Listening…" : "What do you want to know?"}
                </h2>
                <p className="mt-2.5 max-w-[46ch] text-center text-[0.88rem] leading-relaxed text-ink-50">
                  I can see your resume, your profile and every job open to you right now. Speak or
                  type — whichever is easier.
                </p>

                <div
                  className="cc-lift mt-7 flex max-w-lg flex-wrap justify-center gap-2"
                  style={{ "--d": "380ms" } as React.CSSProperties}
                >
                  {OPENERS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => void send(o)}
                      disabled={busy}
                      className="rounded-full border border-ink-15 px-3.5 py-1.5 text-[0.8rem] text-ink-50 transition-colors hover:border-ink-30 hover:text-ink disabled:opacity-40"
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* thread */}
          {turns.length > 0 && (
            <div
              ref={threadRef}
              className="mt-7 min-h-0 flex-1 space-y-5 overflow-y-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {turns.map((t, i) => (
                <div key={i} className={t.role === "user" ? "text-right" : ""}>
                  <p
                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-[0.94rem] leading-relaxed ${
                      t.role === "user" ? "bg-ink text-paper" : "bg-ink-04 text-ink"
                    }`}
                  >
                    {t.text}
                  </p>
                </div>
              ))}
              {busy && (
                <p className="text-[0.9rem] text-ink-30">
                  Thinking
                  <Dots />
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mb-3 text-center text-[0.85rem] text-ink-50">{error}</p>
          )}

          {/* ------------------------------------------------------- controls */}
          <div
            className="cc-lift shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            style={{ "--d": "300ms" } as React.CSSProperties}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(value);
              }}
              className="flex items-center gap-2 rounded-2xl border border-ink-15 bg-paper p-1.5 pl-4 transition-colors focus-within:border-ink-30"
            >
              <input
                ref={inputRef}
                value={listening && speech.interim ? speech.interim : value}
                onChange={(e) => setValue(e.target.value)}
                disabled={busy || listening}
                placeholder={listening ? "Listening…" : "Ask anything about your job search"}
                aria-label="Ask the agent"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[0.95rem] text-ink outline-none placeholder:text-ink-30 disabled:opacity-70"
              />

              {speech.supported && (
                <button
                  type="button"
                  onClick={() => (listening ? speech.stop() : speech.start())}
                  disabled={busy}
                  aria-label={listening ? "Stop listening" : "Speak instead"}
                  aria-pressed={listening}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors disabled:opacity-40 ${
                    listening ? "bg-ink text-paper" : "text-ink-50 hover:bg-ink-04 hover:text-ink"
                  }`}
                >
                  <MicMark />
                </button>
              )}

              <button
                type="submit"
                disabled={busy || value.trim().length < 2 || listening}
                className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity disabled:opacity-30"
              >
                Ask
              </button>
            </form>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.74rem] text-ink-30">
              <p>
                {speech.supported
                  ? "Voice runs in your browser for now — the live call agent is being built."
                  : "Voice needs Chrome or Safari; typing works everywhere."}
              </p>
              {speech.supported && (
                <button
                  type="button"
                  onClick={() => {
                    window.speechSynthesis?.cancel();
                    setSpeakBack((s) => !s);
                  }}
                  className="underline underline-offset-4 transition-colors hover:text-ink"
                >
                  {speakBack ? "Answers read aloud" : "Answers silent"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- orb */

/** The same artwork as the corner, at the size of a thing you talk to. */
function BigOrb({ listening, busy }: { listening: boolean; busy: boolean }) {
  const host = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let anim: AnimationItem | null = null;
    let cancelled = false;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    import("lottie-web/build/player/lottie_light")
      .then((mod) => {
        if (cancelled || !host.current) return;
        const lottie = ((mod as { default?: LottiePlayer }).default ?? mod) as LottiePlayer;
        anim = lottie.loadAnimation({
          container: host.current,
          renderer: "svg",
          loop: true,
          autoplay: !still,
          path: "/ai-orb.json",
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, []);

  return (
    <span className="relative grid h-32 w-32 place-items-center sm:h-40 sm:w-40">
      {/* Rings only while the microphone is actually open — motion that means
          "I am hearing you" must not appear when nothing is being heard. */}
      {listening && (
        <>
          <span
            aria-hidden="true"
            className="cc-ping absolute inset-0 rounded-full border border-ink-15"
          />
          <span
            aria-hidden="true"
            className="cc-ping absolute inset-0 rounded-full border border-ink-15"
            style={{ animationDelay: "0.8s" }}
          />
        </>
      )}

      <span
        aria-hidden="true"
        className={`relative h-full w-full overflow-hidden rounded-full transition-transform duration-500 ${
          busy ? "scale-[0.94]" : "scale-100"
        }`}
      >
        <span
          ref={host}
          className="absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 blur-[10px]"
        />
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- speech */

/**
 * The browser's own speech recognition.
 *
 * Chrome and Safari ship it; Firefox does not, which is why every caller
 * checks `supported` before drawing a microphone. Locale is en-IN so Indian
 * names, cities and "lakh" come back spelled the way people say them.
 *
 * This is deliberately not the product's voice agent. It is speech to text in
 * the browser, free, with no audio leaving the device except as a transcript —
 * good enough to talk to the thing today, and honest about what it is.
 */
type SpeechState = {
  supported: boolean;
  listening: boolean;
  interim: string;
  final: string | null;
  start: () => void;
  stop: () => void;
};

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function useSpeech(): SpeechState {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [final, setFinal] = useState<string | null>(null);
  const recognition = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => RecognitionLike;
      webkitSpeechRecognition?: new () => RecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    setSupported(true);
    const r = new Ctor();
    r.lang = "en-IN";
    r.continuous = false;
    r.interimResults = true;

    r.onresult = (e) => {
      let live = "";
      let done = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) done += res[0].transcript;
        else live += res[0].transcript;
      }
      if (live) setInterim(live);
      if (done.trim()) {
        setInterim("");
        setFinal(done.trim());
      }
    };
    r.onerror = () => setListening(false);
    r.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognition.current = r;
    return () => {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      try {
        r.abort();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  const start = useCallback(() => {
    setFinal(null);
    setInterim("");
    try {
      recognition.current?.start();
      setListening(true);
    } catch {
      /* start() throws if it is already running */
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognition.current?.stop();
    } catch {
      /* not running */
    }
    setListening(false);
  }, []);

  return { supported, listening, interim, final, start, stop };
}

/** Reads an answer back. Cancels anything mid-sentence first. */
function speak(text: string) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 700));
  u.lang = "en-IN";
  u.rate = 1.02;
  synth.speak(u);
}

/* ------------------------------------------------------------------ bits */

function Dots() {
  return (
    <span className="ml-1 inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="cc-dot inline-block h-1 w-1 rounded-full bg-ink-30"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

function MicMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="7.4" y="2.6" width="5.2" height="9.6" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.6 9.4a5.4 5.4 0 0 0 10.8 0M10 14.8V17.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
