"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnimationItem, LottiePlayer } from "lottie-web";
import { PixelField } from "@/components/app/PixelField";
import { setSoundOn, soundOn, startupChime } from "@/lib/app/agent-sound";
import { LiveSession, type LiveState } from "@/lib/app/live-session";
import type { JobCard, ShowJobs } from "@/lib/app/agent-types";

/**
 * The agent, full screen.
 *
 * Opening it is a circle growing out of the orb rather than a new page: the
 * app is swallowed by the thing you pressed, which is why the reveal's origin
 * is passed in from wherever the orb happens to be.
 *
 * One agent, two ways in. Typing goes to generateContent; speaking opens a
 * Live API socket and is a real conversation — it hears you while it talks,
 * and stops when you interrupt. Both are handed the same instructions from
 * agent-brain.ts, so the thing you talk to and the thing you type at behave
 * the same way.
 *
 * The browser's own speech recognition used to sit here as a stand-in. It is
 * gone: it could hear but not listen, it could not be interrupted, and having
 * two voice paths meant every rule had to be written twice.
 *
 * Paper, not a dark room. An immersive black surface was the obvious way to
 * make a full screen feel like a different mode, and it was wrong: the brand
 * is monochrome on white everywhere else. The mode change is carried by the
 * reveal, by the pixel field, and by the size of the orb instead.
 */

type Turn = {
  role: "user" | "model";
  text: string;
  spoken?: boolean;
  /** Jobs the agent put on screen with this turn. */
  jobs?: JobCard[];
  reason?: string;
};

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
  const [pulse, setPulse] = useState(0);

  /* ------------------------------------------------------------ the call */

  const [liveState, setLiveState] = useState<LiveState>("idle");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");   // what they are saying, mid-sentence
  const [saying, setSaying] = useState(""); // what the agent is saying, mid-sentence

  const session = useRef<LiveSession | null>(null);

  /** The jobs the live session may put on screen, by id. */
  const catalogue = useRef<Map<string, JobCard>>(new Map());
  /** Cards the agent asked for but has not finished speaking about yet. */
  const pendingCards = useRef<{ jobs: JobCard[]; reason?: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  /** The conversation row, once the server has made one. */
  const conversation = useRef<string | null>(null);

  const listening = liveState === "live";
  const connecting = liveState === "connecting";

  /* ------------------------------------------------------------- keeping */

  /**
   * Write a turn down.
   *
   * Fire and forget: a transcript that fails to save is worth a line in the
   * console, not an error in front of somebody mid-conversation. The server
   * is the only thing that may write to agent_messages, which is why this is
   * a request rather than an insert.
   */
  const keep = useCallback(
    (messages: Turn[], extra: { seconds?: number; ended?: boolean; channel?: "text" | "voice" } = {}) => {
      if (!messages.length && !extra.seconds) return;
      void fetch("/api/app/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.current,
          channel: extra.channel ?? "text",
          seconds: extra.seconds,
          ended: extra.ended,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.text,
            spoken: !!m.spoken,
            actions: m.jobs?.length ? { jobs: m.jobs, reason: m.reason } : null,
          })),
        }),
      })
        .then((r) => r.json())
        .then((j: { conversationId?: string }) => {
          if (j.conversationId) conversation.current = j.conversationId;
        })
        .catch(() => {
          /* The conversation still works; only the record is lost. */
        });
    },
    [],
  );

  /* ------------------------------------------------------------- closing */

  const close = useCallback(() => {
    session.current?.stop();
    setClosing(true);
    // Long enough for the conceal animation; the state is thrown away after.
    window.setTimeout(onClose, 380);
  }, [onClose]);

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
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = window.setTimeout(() => inputRef.current?.focus(), 420);

    // The ref survives StrictMode's second mount in development, which would
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
      session.current?.stop();
    };
  }, []);

  // Keep the newest exchange in view without yanking the page.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, heard, saying]);

  /* --------------------------------------------------------------- voice */

  const startCall = useCallback(async () => {
    if (session.current?.live) {
      session.current.stop();
      return;
    }
    setError(null);

    const live = new LiveSession({
      onState: setLiveState,
      onLevel: setLevel,
      onError: (m) => setError(m),

      onUserText: (text, final) => {
        if (!final) {
          setHeard(text);
          return;
        }
        setHeard("");
        setTurns((t) => [...t, { role: "user", text, spoken: true }]);
        setPulse((n) => n + 1);
        keep([{ role: "user", text, spoken: true }], { channel: "voice" });
      },

      onAgentText: (text, final) => {
        if (!final) {
          setSaying(text);
          return;
        }
        setSaying("");
        // The cards the model asked for arrive on their own frame, usually
        // before the sentence that explains them finishes. They are held and
        // attached to the turn they belong to rather than floating loose.
        const attached = pendingCards.current;
        pendingCards.current = null;

        const turn: Turn = { role: "model", text, spoken: true, ...(attached ?? {}) };
        setTurns((t) => [...t, turn]);
        setPulse((n) => n + 1);
        keep([turn], { channel: "voice" });
      },

      onShowJobs: (show: ShowJobs) => {
        const jobs = show.jobIds
          .map((id) => catalogue.current.get(id))
          .filter((j): j is JobCard => !!j);
        if (jobs.length) pendingCards.current = { jobs, reason: show.reason };
      },

      onEnded: (seconds) => {
        setLevel(0);
        keep([], { seconds, ended: true, channel: "voice" });
      },
    });

    session.current = live;
    await live.start();

    // The job list came back with the token, so a card can be drawn the
    // instant the model names a role rather than after a round trip.
    const cards = live.jobs;
    if (cards) for (const j of cards) catalogue.current.set(j.id, j);
  }, [keep]);

  /* --------------------------------------------------------------- typing */

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    // Typing while on a call is still the call — the answer comes back spoken.
    if (session.current?.live) {
      session.current.send(message);
      setValue("");
      setTurns((t) => [...t, { role: "user", text: message }]);
      keep([{ role: "user", text: message }], { channel: "voice" });
      return;
    }

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
        body: JSON.stringify({ turns: next.map((t) => ({ role: t.role, text: t.text })) }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        error?: string;
        show?: { jobs?: JobCard[]; reason?: string };
      };

      if (!res.ok || !json.ok || !json.reply) {
        setError(json.error ?? "That didn't go through.");
        return;
      }

      const turn: Turn = {
        role: "model",
        text: json.reply,
        ...(json.show?.jobs?.length ? { jobs: json.show.jobs, reason: json.show.reason } : {}),
      };
      setTurns([...next, turn]);
      setPulse((n) => n + 1);
      keep([{ role: "user", text: message }, turn]);
    } catch {
      setError("Network trouble. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------------------- shell */

  // How far the circle has to travel to swallow the screen, measured rather
  // than guessed. The CSS fallback of 160vmax is nearly half as much again as
  // the furthest corner ever is, so an eased animation spent most of its
  // duration growing a circle that had already covered everything.
  const radius = useMemo(() => {
    if (typeof window === "undefined") return 1600;
    const dx = Math.max(origin.x, window.innerWidth - origin.x);
    const dy = Math.max(origin.y, window.innerHeight - origin.y);
    return Math.ceil(Math.hypot(dx, dy)) + 2;
  }, [origin.x, origin.y]);

  const empty = turns.length === 0 && !heard && !saying;

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
            atmosphere, the same texture behind a paragraph is noise.
            While the call is live it answers the voice — the level comes off
            the microphone, so the grid moves when the room does. */}
        <PixelField
          className={`cc-lift transition-opacity duration-700 ${
            empty ? "opacity-100" : "opacity-35"
          }`}
          energy={listening ? Math.max(0.45, level) : busy || connecting ? 0.62 : 0.12}
          pulse={pulse}
        />

        {!empty && (
          <div className="absolute left-5 top-5 z-10 flex items-center gap-2.5 sm:left-7 sm:top-7">
            <OrbMark className="h-6 w-6" />
            <span className="text-[0.78rem] font-medium tracking-[-0.01em] text-ink-50">
              {listening ? "On a call" : "Cheatcode agent"}
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
          {empty && (
            <div
              className="cc-lift flex shrink-0 flex-col items-center pt-[13vh]"
              style={{ "--d": "180ms" } as React.CSSProperties}
            >
              <BigOrb listening={listening} busy={busy || connecting} level={level} />

              <h2 className="mt-7 text-center text-[1.35rem] font-semibold leading-snug tracking-[-0.03em] sm:text-[1.6rem]">
                {connecting ? "Connecting…" : listening ? "Go ahead" : "What do you want to know?"}
              </h2>
              <p className="mt-2.5 max-w-[46ch] text-center text-[0.88rem] leading-relaxed text-ink-50">
                {listening
                  ? "Talk normally. Interrupt whenever you like — it stops when you start."
                  : "I can see your resume, your profile and every job open to you right now. Press the mic to talk, or type."}
              </p>

              {!listening && !connecting && (
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
              )}
            </div>
          )}

          {empty && <div className="flex-1" />}

          {!empty && (
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
                    <div className="min-w-0 max-w-[85%]">
                      <p className="whitespace-pre-wrap rounded-2xl bg-ink-04 px-4 py-3 text-[0.94rem] leading-relaxed text-ink">
                        {t.text}
                      </p>
                      {!!t.jobs?.length && <Cards jobs={t.jobs} reason={t.reason} />}
                    </div>
                  </div>
                ),
              )}

              {/* Mid-sentence, both directions. Shown greyed so it is obvious
                  these are not yet settled — a transcript revises itself as it
                  goes, and text that silently rewrites is unnerving. */}
              {heard && (
                <div className="text-right">
                  <p className="inline-block max-w-[85%] rounded-2xl bg-ink-04 px-4 py-3 text-left text-[0.94rem] leading-relaxed text-ink-50">
                    {heard}
                  </p>
                </div>
              )}
              {saying && (
                <div className="flex gap-3">
                  <OrbMark className="mt-1 h-7 w-7 shrink-0" />
                  <p className="max-w-[85%] rounded-2xl bg-ink-04 px-4 py-3 text-[0.94rem] leading-relaxed text-ink-50">
                    {saying}
                  </p>
                </div>
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

          {error && <p className="mb-3 text-center text-[0.85rem] text-ink-50">{error}</p>}

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
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={busy}
                placeholder={
                  listening ? "…or type, and it will still answer aloud" : "Ask anything about your job search"
                }
                aria-label="Ask the agent"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[0.95rem] text-ink outline-none placeholder:text-ink-30 disabled:opacity-70"
              />

              <button
                type="button"
                onClick={() => void startCall()}
                disabled={connecting}
                aria-label={listening ? "End the call" : "Talk to the agent"}
                aria-pressed={listening}
                className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors disabled:opacity-50 ${
                  listening ? "bg-ink text-paper" : "text-ink-50 hover:bg-ink-04 hover:text-ink"
                }`}
              >
                {/* The ring is the microphone level, not a loop: it is the one
                    honest signal that the thing is actually hearing you. */}
                {listening && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-xl border border-ink-30"
                    style={{ transform: `scale(${1 + level * 0.35})`, opacity: 0.25 + level * 0.5 }}
                  />
                )}
                {connecting ? <Dots /> : <MicMark />}
              </button>

              <button
                type="submit"
                disabled={busy || value.trim().length < 2}
                className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity disabled:opacity-30"
              >
                Ask
              </button>
            </form>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[0.74rem] text-ink-30">
              <p>
                {listening
                  ? "On a call. Press the mic again to hang up."
                  : "Voice is a real conversation — it hears you while it talks."}
              </p>
              {/* One switch for everything the screen does audibly. Two
                  switches for a screen with one voice is a settings panel
                  nobody asked for. */}
              <button
                type="button"
                onClick={() =>
                  setSound((s) => {
                    setSoundOn(!s);
                    return !s;
                  })
                }
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

/* ----------------------------------------------------------------- cards */

/** The jobs the agent put on screen, because a voice cannot hand over a link. */
function Cards({ jobs, reason }: { jobs: JobCard[]; reason?: string }) {
  return (
    <div className="mt-2.5">
      {reason && <p className="mb-2 px-1 text-[0.78rem] text-ink-30">{reason}</p>}
      <ul className="flex flex-wrap gap-2">
        {jobs.map((j) => (
          <li key={j.id}>
            <a
              href={j.apply_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex flex-col rounded-xl border border-ink-08 px-3.5 py-2.5 transition-colors hover:border-ink-30"
            >
              <span className="text-[0.84rem] font-medium leading-snug text-ink">{j.title}</span>
              <span className="mt-0.5 text-[0.75rem] text-ink-30">
                {j.company}
                {j.cities.length ? ` · ${j.cities.join(", ")}` : j.is_remote ? " · Remote" : ""}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
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
function BigOrb({
  listening,
  busy,
  level,
}: {
  listening: boolean;
  busy: boolean;
  level: number;
}) {
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
        className={`relative h-full w-full overflow-hidden rounded-full transition-transform duration-300 ${
          busy ? "scale-[0.94]" : ""
        }`}
        // Breathes with the room while the call is open.
        style={listening ? { transform: `scale(${1 + level * 0.08})` } : undefined}
      >
        <span
          ref={host}
          className="absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 blur-[10px]"
        />
      </span>
    </span>
  );
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
