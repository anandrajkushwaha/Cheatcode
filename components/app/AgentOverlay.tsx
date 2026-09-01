"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnimationItem, LottiePlayer } from "lottie-web";
import { PixelField } from "@/components/app/PixelField";
import { setSoundOn, soundOn, startupChime } from "@/lib/app/agent-sound";

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
 * reads as a different product. The mode change is carried by the reveal, by
 * the pixel field, and by the size of the orb instead.
 *
 * The orb is only large while the screen is still a question. Once there is a
 * conversation, a 160px animation at the top of it is competing with the thing
 * somebody came here to read, so it shrinks to the mark beside each answer —
 * the same artwork, doing the job an avatar does.
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
  const [sound, setSound] = useState(true);

  // Every increment sends a ring out through the pixel field. Sending and
  // receiving both count: the gap between them is the part of the interaction
  // that otherwise has nothing to show.
  const [pulse, setPulse] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech();

  /* ------------------------------------------------------------- closing */

  // Only `stop` is needed here, and it is stable — depending on the whole
  // speech object would rebuild `close` on every interim transcript.
  const stopListening = speech.stop;

  const close = useCallback(() => {
    stopListening();
    window.speechSynthesis?.cancel();
    setClosing(true);
    // Long enough for the conceal animation; the state is thrown away after.
    window.setTimeout(onClose, 380);
  }, [onClose, stopListening]);

  // Escape, separately from the arrival, so a changing handler cannot restart
  // the things below that must happen exactly once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  /* -------------------------------------------------------------- arrival */

  const arrived = useRef(false);

  useEffect(() => {
    // The page behind must not scroll under a full-screen surface.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = window.setTimeout(() => inputRef.current?.focus(), 420);

    // Read once, on the way in. The preference lives in localStorage so
    // somebody who turned it off does not get startled again tomorrow. The
    // ref survives StrictMode's second mount in development, which would
    // otherwise play the chime twice.
    if (!arrived.current) {
      arrived.current = true;
      const on = soundOn();
      setSound(on);
      if (on) startupChime();
      setPulse((n) => n + 1);
    }

    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(t);
      window.speechSynthesis?.cancel();
    };
  }, []);

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
    setPulse((n) => n + 1);

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
      setPulse((n) => n + 1);
      if (sound) speak(json.reply);
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
        {/* The field sits behind everything and is masked out before it
            reaches the controls. Once there is a conversation it steps back to
            a third of its weight: a texture behind an empty screen is
            atmosphere, the same texture behind a paragraph is noise. */}
        <PixelField
          className={`cc-lift transition-opacity duration-700 ${
            turns.length > 0 ? "opacity-35" : "opacity-100"
          }`}
          energy={listening ? 1 : busy ? 0.62 : 0.12}
          pulse={pulse}
        />

        {/* Once the orb has left the middle, something has to say whose screen
            this is. */}
        {turns.length > 0 && (
          <div className="absolute left-5 top-5 z-10 flex items-center gap-2.5 sm:left-7 sm:top-7">
            <OrbMark className="h-6 w-6" />
            <span className="text-[0.78rem] font-medium tracking-[-0.01em] text-ink-50">
              Cheatcode agent
            </span>
          </div>
        )}

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
          {/* The opening question. Sat high rather than centred: the field is
              densest at the top, and the orb belongs inside it. */}
          {turns.length === 0 && (
            <div
              className="cc-lift flex shrink-0 flex-col items-center pt-[13vh]"
              style={{ "--d": "180ms" } as React.CSSProperties}
            >
              <BigOrb listening={listening} busy={busy} />

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
                    className="rounded-full border border-ink-15 bg-paper/70 px-3.5 py-1.5 text-[0.8rem] text-ink-50 backdrop-blur-[2px] transition-colors hover:border-ink-30 hover:text-ink disabled:opacity-40"
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Holds the question block up against the field and the controls
              down against the bottom edge. */}
          {turns.length === 0 && <div className="flex-1" />}

          {/* thread — starts below the identity mark in the corner */}
          {turns.length > 0 && (
            <div
              ref={threadRef}
              className="mt-[4.5rem] min-h-0 flex-1 space-y-5 overflow-y-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {turns.map((t, i) =>
                t.role === "user" ? (
                  <div key={i} className="text-right">
                    <p className="inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl bg-ink px-4 py-3 text-left text-[0.94rem] leading-relaxed text-paper">
                      {t.text}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <OrbMark className="mt-1 h-7 w-7 shrink-0" />
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-ink-04 px-4 py-3 text-[0.94rem] leading-relaxed text-ink">
                      {t.text}
                    </p>
                  </div>
                ),
              )}
              {busy && (
                <div className="flex items-center gap-3">
                  <OrbMark className="h-7 w-7 shrink-0 animate-pulse" />
                  <p className="text-[0.9rem] text-ink-30">
                    Thinking
                    <Dots />
                  </p>
                </div>
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
              {/* One switch for everything the screen does audibly — the
                  opening chime and the spoken answers. Two switches for a
                  screen with one voice is a settings panel nobody asked for. */}
              <button
                type="button"
                onClick={() => {
                  window.speechSynthesis?.cancel();
                  setSound((s) => {
                    setSoundOn(!s);
                    return !s;
                  });
                }}
                aria-pressed={sound}
                className="underline underline-offset-4 transition-colors hover:text-ink"
              >
                {sound ? "Sound on" : "Sound off"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- orb */

/**
 * The orb at avatar size.
 *
 * A painted disc rather than a third Lottie instance. The player is 1080×1080
 * of animating SVG; one of those beside every reply in a long thread is a
 * repaint per frame per message, and at 26px nobody can see it moving anyway.
 * The colours are the artwork's own, sampled from its four fills.
 */
function OrbMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full ${className ?? ""}`}
      style={{
        background:
          "radial-gradient(circle at 34% 28%, #fef5bd 0%, #f8e152 30%, #ff8e3a 64%, #ff7100 100%)",
      }}
    />
  );
}

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
    // 104px on a phone, not 128. A third of a 390px screen is a lot of orange
    // above a question somebody is trying to read; the desktop size was picked
    // against 1440px and carried over without being looked at again.
    <span className="relative grid h-26 w-26 place-items-center sm:h-40 sm:w-40">
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

  // Memoised because callers put this object in dependency arrays. Returned
  // as a fresh literal it changed identity on every render, which made every
  // effect that depended on it re-run on every render — including the one
  // that opens the surface, which then set state, which rendered again.
  return useMemo(
    () => ({ supported, listening, interim, final, start, stop }),
    [supported, listening, interim, final, start, stop],
  );
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
