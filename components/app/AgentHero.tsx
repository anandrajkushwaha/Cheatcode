"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The first thing you see after signing in.
 *
 * Not a dashboard. A dashboard makes you read six numbers and decide what to
 * do about them, and most people decide to leave. This asks one question,
 * accepts an ordinary sentence as the answer, and turns that sentence into the
 * fields matching runs on — which is the same job the voice agent will do
 * later, done in text because text ships tonight.
 *
 * The motion is load-bearing. The orb says the thing is awake, the caret says
 * the sentence is being written for you rather than replayed, the dots say the
 * model is working. Take the animation away — as prefers-reduced-motion does —
 * and every one of those states is still spelled out in words.
 */

type Gap = { key: string; label: string; href: string };

const PROMPTS = [
  "Backend roles in Bengaluru, open to remote",
  "Product design, 4 years, around 25 LPA",
  "Data analyst in Pune or Hyderabad, 30 days notice",
  "Fresher, any SDE role, immediate joiner",
];

export function AgentHero({
  greeting,
  line,
  gaps,
  hasIntent,
}: {
  greeting: string;
  line: string;
  gaps: Gap[];
  hasIntent: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ ok: boolean; text: string } | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const typed = useTyped(line);
  const still = useReducedMotion();

  // Rotate the example only while the box is untouched. Once someone is
  // typing, a changing placeholder is just movement in the corner of the eye.
  useEffect(() => {
    if (value || busy || still) return;
    const t = setInterval(() => setPromptIndex((i) => (i + 1) % PROMPTS.length), 3800);
    return () => clearInterval(t);
  }, [value, busy, still]);

  async function send(text: string) {
    const sentence = text.trim();
    if (sentence.length < 3 || busy) return;

    setBusy(true);
    setReply(null);
    try {
      const res = await fetch("/api/app/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        note?: string;
        echo?: string | null;
        saved?: Record<string, unknown>;
      };

      if (!res.ok || !json.ok) {
        setReply({ ok: false, text: json.error ?? "That didn't go through. Try again." });
        return;
      }
      if (json.note) {
        setReply({ ok: false, text: json.note });
        return;
      }

      setValue("");
      setReply({
        ok: true,
        text: json.echo
          ? `Got it — ${json.echo}. Saved to your profile.`
          : "Saved to your profile.",
      });
      // The rails above and below read from the same profile row.
      router.refresh();
    } catch {
      setReply({ ok: false, text: "Network trouble. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cc-rise cc-aura relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="flex items-start gap-4 sm:gap-5">
        <Orb busy={busy} />

        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-ink-50">{greeting}</p>

          <h1 className="mt-2 text-[1.35rem] font-semibold leading-snug tracking-[-0.03em] sm:text-[1.6rem]">
            {typed}
            {!still && (
              <span className="cc-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.14em] bg-ink" />
            )}
          </h1>
        </div>
      </div>

      {/* ------------------------------------------------------------ input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(value);
        }}
        className="mt-6"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-ink-15 bg-paper p-1.5 pl-4 transition-colors focus-within:border-sky-1">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            placeholder={PROMPTS[promptIndex]}
            aria-label="Tell the agent what you're looking for"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[0.95rem] text-ink outline-none placeholder:text-ink-30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || value.trim().length < 3}
            className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity disabled:opacity-30"
          >
            {busy ? <Dots /> : "Tell me"}
          </button>
        </div>
      </form>

      {/* ---------------------------------------------------------- answer */}
      <div aria-live="polite" className="min-h-[1.4rem]">
        {busy && (
          <p className="mt-3 text-[0.85rem] text-ink-30">Reading what you said…</p>
        )}
        {!busy && reply && (
          <p
            className={`cc-pop mt-3 text-[0.85rem] leading-relaxed ${
              reply.ok ? "text-ink-70" : "text-ink-50"
            }`}
          >
            {reply.text}
          </p>
        )}
      </div>

      {/* ----------------------------------------------------------- chips
          Gaps first — those are the real jobs to be done. Examples only fill
          in behind them, so the row is never empty and never crowded. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {gaps.slice(0, 3).map((g) => (
          <a
            key={g.key}
            href={g.href}
            className="rounded-full border border-ink-15 bg-paper px-3.5 py-1.5 text-[0.8rem] font-medium text-ink-70 transition-colors hover:border-sky-1 hover:text-ink"
          >
            {g.label}
          </a>
        ))}

        {PROMPTS.slice(0, Math.max(0, (hasIntent ? 2 : 3) - gaps.length)).map((p) => (
          <button
            key={p}
            type="button"
            disabled={busy}
            onClick={() => {
              setValue(p);
              inputRef.current?.focus();
            }}
            className="rounded-full border border-dashed border-ink-15 px-3.5 py-1.5 text-[0.8rem] text-ink-30 transition-colors hover:border-ink-30 hover:text-ink-70 disabled:opacity-40"
          >
            “{p}”
          </button>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- orb */

/**
 * Two conic sweeps at different speeds, blurred, around a white disc — the
 * same two hues as the panel's border, so the colour on this screen comes
 * from exactly two places and they agree. It reads as a lit ring rather than
 * a loading spinner, which matters: a spinner promises completion, and this
 * is an idle state.
 */
function Orb({ busy }: { busy: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid h-12 w-12 shrink-0 place-items-center sm:h-14 sm:w-14 ${
        busy ? "" : "cc-orb"
      }`}
    >
      <span className="absolute inset-0 overflow-hidden rounded-full">
        <span
          className="cc-orb-a absolute -inset-[40%] blur-[6px]"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, var(--color-sky-1) 60deg, transparent 130deg, var(--color-agent) 210deg, transparent 280deg, var(--color-sky-2) 330deg, transparent 360deg)",
            opacity: 0.75,
          }}
        />
        <span
          className={`absolute -inset-[35%] blur-[8px] ${busy ? "cc-orb-a" : "cc-orb-b"}`}
          style={{
            background:
              "conic-gradient(from 180deg, transparent 0deg, var(--color-sky-4) 50deg, transparent 130deg)",
            opacity: busy ? 0.5 : 0.24,
          }}
        />
      </span>
      <span className="relative h-[62%] w-[62%] rounded-full bg-paper shadow-[0_0_0_1px_var(--color-ink-08)]" />
      <span className="absolute h-1.5 w-1.5 rounded-full bg-sky-3" />
    </span>
  );
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-1 px-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="cc-dot h-1 w-1 rounded-full bg-paper"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ hooks */

/** Types a sentence out once. Returns it whole if motion is turned down. */
function useTyped(full: string): string {
  const still = useReducedMotion();
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (still) {
      setShown(full);
      return;
    }
    setShown("");
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(full.slice(0, i));
      if (i >= full.length) clearInterval(t);
    }, 18);
    return () => clearInterval(t);
  }, [full, still]);

  return shown;
}

/**
 * Starts true so the server render and the first client render agree — the
 * full sentence, no animation — and only then relaxes into motion. Starting
 * false would type the sentence twice on hydration.
 */
function useReducedMotion(): boolean {
  const [still, setStill] = useState(true);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(q.matches);
    const on = () => setStill(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);

  return still;
}
