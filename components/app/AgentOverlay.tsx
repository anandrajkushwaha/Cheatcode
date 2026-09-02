"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnimationItem, LottiePlayer } from "lottie-web";
import { PixelField } from "@/components/app/PixelField";
import { ResumePanel } from "@/components/app/ResumePanel";
import { ManualInput } from "@/components/app/ManualInput";
import { soundOn, startupChime } from "@/lib/app/agent-sound";
import { LiveSession, type LiveState } from "@/lib/app/live-session";
import type { JobCard, ShowJobs, ToolResult, UiAction } from "@/lib/app/agent-types";
import type { FieldSpec, Resume } from "@/lib/app/resume-schema";
import { readAnyFile, ExtractError } from "@/lib/app/read-file";

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

/**
 * One line of the streamed answer.
 *
 * The route sends newline-delimited JSON: any number of `delta` lines, then
 * exactly one `done` or one `error`.
 */
type Finished = {
  t?: "done";
  reply?: string;
  /** What the tools the agent ran asked the screen to do. */
  actions?: UiAction[];
  show?: { jobs?: JobCard[]; reason?: string };
  configured?: boolean;
  messagesLeft?: number;
  paid?: boolean;
};

type Line = Finished | { t: "delta"; v?: string } | { t: "error"; error?: string };

/** A file handed over mid-conversation, and where it has got to. */
type Attachment =
  | { phase: "reading"; name: string }
  | { phase: "saving"; name: string }
  | { phase: "error"; name: string; message: string };

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
  /** What is left, as the server last reported it. Null until it says. */
  const [messagesLeft, setMessagesLeft] = useState<number | null>(null);
  const [voiceLeft, setVoiceLeft] = useState<number | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  /**
   * Whether this server has a meter at all.
   *
   * Not the same question as how much is left, and conflating them is a
   * mistake this file has now made twice: an unmetered server reports zero,
   * and zero reads on screen as "you have used everything up".
   */
  const [metered, setMetered] = useState(true);
  /** The greeting, on screen. Replaces the stock question once it arrives. */
  const [heading, setHeading] = useState("What do you want to know?");
  /**
   * The line the agent opens a call with. Held rather than spoken: opening
   * this screen is not a conversation, and being read a paragraph for pressing
   * a button is an interruption. It is only used if a call actually starts.
   */
  const opening = useRef<string | null>(null);
  const [pulse, setPulse] = useState(0);

  /**
   * The resume, beside the conversation.
   *
   * Opened by a tool result rather than by the model writing markup: the
   * agent can ask for this panel and nothing else, and `revision` is bumped
   * whenever something was saved so the panel refetches instead of showing a
   * document that is one sentence out of date.
   */
  const [showResume, setShowResume] = useState(false);
  const [revision, setRevision] = useState(0);

  /**
   * A form the agent asked for, over the conversation.
   *
   * The fields were resolved against the resume schema on the server, so what
   * is held here is a list of specifications rather than anything the model
   * wrote. Null means no form.
   */
  const [form, setForm] = useState<{ fields: FieldSpec[]; reason?: string } | null>(null);

  /* ------------------------------------------------------------ the call */

  const [liveState, setLiveState] = useState<LiveState>("idle");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");   // what they are saying, mid-sentence
  const [saying, setSaying] = useState(""); // what the agent is saying, mid-sentence

  const session = useRef<LiveSession | null>(null);

  /* ------------------------------------------------------------ call mode */

  /**
   * A call is its own screen, not a mic icon in a text box.
   *
   * The mic used to be a 40px glyph sitting inside the composer, which meant
   * the one thing this product does that nothing else does was the least
   * visible control on the page. Pressing it now takes the screen over the way
   * a call does: a timer, a caption, mute, and a way to hang up — so it is
   * obvious what state you are in and obvious how to leave it.
   */
  const [callSeconds, setCallSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  /** The keypad, for typing mid-call. Off by default: a call is for talking. */
  const [typing, setTyping] = useState(false);
  /**
   * Why the last call did not happen.
   *
   * Kept apart from the ordinary error line, which is a 0.74rem grey sentence
   * above the composer — right for "try rewording that", useless for a call
   * that vanished a second after it was pressed. A refused call now says so
   * where the person was looking, and offers to try again.
   */
  const [callError, setCallError] = useState<string | null>(null);

  /* ------------------------------------------------------------ the file */

  /**
   * A document somebody handed over mid-conversation.
   *
   * Reading it is two waits with nothing to look at — pulling text out of a
   * PDF, then saving and parsing it — so it gets a chip that says which stage
   * it is at. A file that fails says why on the chip and nowhere else: the
   * failure is about that file, not about the conversation.
   */
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [dragging, setDragging] = useState(false);
  /** dragenter/dragleave fire for every child; only the balance matters. */
  const dragDepth = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  /** The jobs the live session may put on screen, by id. */
  const catalogue = useRef<Map<string, JobCard>>(new Map());
  /** Cards the agent asked for but has not finished speaking about yet. */
  const pendingCards = useRef<{ jobs: JobCard[]; reason?: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  /** The conversation row, once the server has made one. */
  const conversation = useRef<string | null>(null);

  /**
   * The thread, readable from a callback that must not be rebuilt.
   *
   * `startCall` is memoised on `keep` alone, so reading `turns` from its
   * closure would have handed the call whatever the thread looked like on
   * first render — which is nothing. The recap would have shipped, been
   * empty every time, and the bug would have looked fixed.
   */
  const turnsRef = useRef<Turn[]>([]);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

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
    (
      messages: Turn[],
      extra: {
        seconds?: number;
        ended?: boolean;
        channel?: "text" | "voice";
        /** The realtime model that answered, so the call can be costed. */
        model?: string | null;
      } = {},
    ) => {
      if (!messages.length && !extra.seconds) return;
      void fetch("/api/app/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.current,
          channel: extra.channel ?? "text",
          seconds: extra.seconds,
          ended: extra.ended,
          model: extra.model ?? null,
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
    // Here as well as in the unmount effect, which runs 380ms later when the
    // conceal animation finishes — a call has to end when the screen goes, not
    // when the animation does.
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
      if (soundOn()) startupChime();
      setPulse((n) => n + 1);

      // Nothing is said here. The greeting used to be spoken over the chime,
      // and it was a paragraph listing what the agent could do — the tone of a
      // hold message, delivered to somebody who had just pressed a button and
      // not yet asked anything. The heading carries the name, silently; the
      // one-liner waits until there is a call for it to open.
      void fetch("/api/app/agent/hello")
        .then((r) => r.json())
        .then((j: { ok?: boolean; heading?: string; opening?: string }) => {
          if (!j.ok) return;
          if (j.heading) setHeading(j.heading);
          if (j.opening) opening.current = j.opening;
        })
        .catch(() => {
          /* A silent agent is still a usable one. */
        });
    }

    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(t);
      session.current?.stop();
    };
  }, []);

  /**
   * The clock, while the call is up.
   *
   * Counted here rather than derived from the session's start time because
   * this is the number somebody watches to decide whether they are about to
   * run out — it has to advance every second, visibly, even if nothing is
   * being said.
   */
  useEffect(() => {
    if (liveState !== "live") {
      setCallSeconds(0);
      setMuted(false);
      setTyping(false);
      return;
    }
    setCallSeconds(0);
    const id = window.setInterval(() => setCallSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [liveState]);

  // Keep the newest exchange in view without yanking the page.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, heard, saying]);

  /* --------------------------------------------------------------- tools */

  /**
   * What a tool asked the screen to do.
   *
   * A closed set, matched by name. An action the frontend does not recognise
   * is ignored — which is the whole point of the indirection: the model can
   * ask for one of these, and it cannot ask for anything else.
   */
  const applyAction = useCallback((action: UiAction | undefined) => {
    if (!action) return;
    if (action.type === "SHOW_RESUME_PREVIEW") {
      setShowResume(true);
      setRevision((n) => n + 1);
      return;
    }
    if (action.type === "SHOW_MANUAL_INPUT") {
      setForm({ fields: action.fields, reason: action.reason });
      return;
    }
    if (action.type === "SHOW_JOBS") {
      const jobs = action.jobIds
        .map((id) => catalogue.current.get(id))
        .filter((j): j is JobCard => !!j);
      if (jobs.length) pendingCards.current = { jobs, reason: action.reason };
    }
  }, []);

  /**
   * The agent called a tool during a live call.
   *
   * The browser is a courier here, not an authority: it forwards the name and
   * arguments to the server, which decides whether that is a real tool and
   * runs it as the signed-in user. Anything that changes data goes that way.
   *
   * `show_jobs` is the exception and is answered here, because the cards were
   * sent down with the ticket and a round trip in the middle of somebody
   * speaking is a pause they can hear.
   */
  const runTool = useCallback(
    async (name: string, rawArgs: unknown): Promise<unknown> => {
      if (name === "show_jobs") {
        let args: unknown = {};
        try {
          args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
        } catch {
          /* An unparseable argument bag is an empty one. */
        }
        const ids = (args as { job_ids?: unknown }).job_ids;
        applyAction({
          type: "SHOW_JOBS",
          jobIds: Array.isArray(ids) ? ids.filter((v): v is string => typeof v === "string") : [],
          reason: (args as { reason?: string }).reason,
        });
        return { ok: true, summary: "Shown on screen." };
      }

      try {
        const res = await fetch("/api/app/agent/tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, args: rawArgs }),
        });
        const result = (await res.json()) as ToolResult;
        applyAction(result.action);
        // The action is for us; the model is told the summary and the data.
        return { ok: result.ok, summary: result.summary, data: result.data };
      } catch {
        // Never throw: the transport is waiting on this, and a rejected
        // promise leaves the model waiting for a result that never arrives.
        return { ok: false, summary: "That did not save — the network dropped it." };
      }
    },
    [applyAction],
  );

  /**
   * A filled-in form, saved and then mentioned to the agent.
   *
   * Two things have to happen and the order matters. The values go through the
   * same store everything else writes through — so a typed email is cleaned
   * and scored exactly like a spoken one — and only then is the agent told,
   * because an agent that hears "saved" before the save has landed will
   * eventually say so after one has failed.
   *
   * What it is told is a plain sentence, not the values. It does not need to
   * read somebody's email address back to them, and being told the field names
   * rather than the contents keeps a phone number out of the transcript.
   */
  const submitForm = useCallback(
    async (patch: Partial<Resume>, labels: string[]) => {
      const res = await fetch("/api/app/resume/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "That didn't save.");

      setForm(null);
      setRevision((n) => n + 1);

      const said = labels.length
        ? `[they filled in the form: ${labels.join(", ")}]`
        : "[they closed the form without filling it in]";

      // Into whichever channel is live. On a call this arrives as a typed
      // message the agent can answer aloud without the call being interrupted.
      if (session.current?.live) {
        session.current.send(said);
      } else {
        setTurns((t) => [...t, { role: "user", text: said }]);
      }
    },
    [],
  );

  /* --------------------------------------------------------------- voice */

  const startCall = useCallback(async () => {
    if (session.current?.live) {
      session.current.stop();
      return;
    }
    setError(null);
    setCallError(null);

    const live = new LiveSession({
      onState: setLiveState,
      onLevel: setLevel,
      onError: (m) => {
        // A failure while connecting is a call that never happened, and it
        // needs a different, louder home than a mid-conversation hiccup.
        if (!session.current?.live) setCallError(m);
        else setError(m);
      },

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

      onTool: runTool,

      onShowJobs: (show: ShowJobs) => {
        const jobs = show.jobIds
          .map((id) => catalogue.current.get(id))
          .filter((j): j is JobCard => !!j);
        if (jobs.length) pendingCards.current = { jobs, reason: show.reason };
      },

      onEnded: (seconds) => {
        setLevel(0);
        keep([], { seconds, ended: true, channel: "voice", model: live.model });
        // Optimistic, so the number on screen does not lag a whole session
        // behind. The server's answer overwrites it on the next request.
        setVoiceLeft((v) => (v === null ? null : Math.max(0, v - seconds)));
      },
    });

    session.current = live;
    // What is on screen goes with it. Without this the spoken agent begins
    // from nothing and asks for things it was given a minute ago. When there
    // is nothing on screen, it opens with a line instead of a silence — the
    // session drops the opening whenever the recap has anything in it.
    await live.start(
      turnsRef.current.map((t) => ({ role: t.role, text: t.text })),
      opening.current ?? undefined,
    );

    if (typeof live.remaining === "number") setVoiceLeft(live.remaining);
    if (live.upgrade) setUpgrade(true);
    if (!live.metered) setMetered(false);

    // The job list came back with the token, so a card can be drawn the
    // instant the model names a role rather than after a round trip.
    const cards = live.jobs;
    if (cards) for (const j of cards) catalogue.current.set(j.id, j);
  }, [keep, runTool]);

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
      // A refusal — not signed in, throttled, out of messages — is still an
      // ordinary JSON body with a real status code. Only an answer streams.
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          upgrade?: boolean;
          configured?: boolean;
          messagesLeft?: number;
        };
        // A server with no limits table has no count to report, and treating
        // its silence as zero is what put "No messages left today." under an
        // error saying the table was missing.
        if (json.configured === false) setMetered(false);
        else if (typeof json.messagesLeft === "number") {
          setMetered(true);
          setMessagesLeft(json.messagesLeft);
        }
        setError(json.error ?? "That didn't go through.");
        // 402 is the paywall, and it is the one failure worth pointing
        // somewhere rather than just apologising for.
        if (json.upgrade) setUpgrade(true);
        return;
      }

      setUpgrade(false);

      /**
       * The answer, as it is written.
       *
       * A turn is appended the moment the first fragment lands and then grown
       * in place, so the screen has something to read within a second instead
       * of a dot that pulses for four. `settled` guards the finally block:
       * only a stream that never produced anything should be rolled back.
       */
      let streamed = "";
      let placed = false;
      // A holder rather than two `let`s: TypeScript does not track assignments
      // made inside the reader callback, and would narrow both to null.
      const out: { done: Finished | null; failed: string | null } = {
        done: null,
        failed: null,
      };

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const consume = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return;
        let event: Line;
        try {
          event = JSON.parse(trimmed) as Line;
        } catch {
          return;
        }

        if (event.t === "delta" && event.v) {
          streamed += event.v;
          if (!placed) {
            placed = true;
            setBusy(false); // there is something on screen now
            setTurns([...next, { role: "model", text: streamed }]);
          } else {
            setTurns((all) => {
              const copy = [...all];
              copy[copy.length - 1] = { ...copy[copy.length - 1], text: streamed };
              return copy;
            });
          }
        } else if (event.t === "done") {
          out.done = event as Finished;
        } else if (event.t === "error") {
          out.failed = event.error ?? "That didn't go through.";
        }
      };

      if (reader) {
        for (;;) {
          const { done: finished, value } = await reader.read();
          if (finished) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            consume(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
          }
        }
        consume(buffer);
      }

      const { done, failed } = out;

      // Tool results reach the screen the same way in both channels: a typed
      // action the frontend interprets, never markup from the model.
      for (const action of done?.actions ?? []) applyAction(action);

      if (done?.configured === false) setMetered(false);
      else if (typeof done?.messagesLeft === "number") {
        setMetered(true);
        setMessagesLeft(done.messagesLeft);
      }

      if (failed || !done) {
        // Nothing usable arrived. Take the half-written turn back off the
        // screen rather than leaving a sentence that stops mid-word.
        if (placed) setTurns(next);
        setError(failed ?? "That didn't go through.");
        return;
      }

      const turn: Turn = {
        role: "model",
        // The finished reply, not the accumulated deltas — it is the one the
        // server actually recorded, and on a provider that never streamed a
        // fragment it is the only one there is.
        text: done.reply ?? streamed,
        ...(done.show?.jobs?.length ? { jobs: done.show.jobs, reason: done.show.reason } : {}),
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

  /* ------------------------------------------------------------- the file */

  /**
   * Read a dropped file, save it, and let the agent open on it.
   *
   * Reading happens in the browser wherever the file has text in it, so a
   * document with somebody's phone number and salary history on it never
   * reaches a server that does not need it. Only a scan or a photo — where
   * there is no text to find — goes anywhere, and the chip says so.
   *
   * It is then saved through the ordinary resume route, which parses it,
   * scores it and fills the blank profile fields, so a resume that arrived in
   * the conversation is the same resume as one uploaded on the resume page.
   */
  const attach = useCallback(
    async (file: File) => {
      if (busy) return;
      setAttachment({ phase: "reading", name: file.name });
      setError(null);

      let read: Awaited<ReturnType<typeof readAnyFile>>;
      try {
        read = await readAnyFile(file);
      } catch (e) {
        setAttachment({
          phase: "error",
          name: file.name,
          message:
            e instanceof ExtractError
              ? e.message
              : "Something went wrong reading that file. Try a PDF.",
        });
        return;
      }

      if (read.text.replace(/\s/g, "").length < 120) {
        setAttachment({
          phase: "error",
          name: file.name,
          message: "There's almost nothing in that file to read.",
        });
        return;
      }

      setAttachment({ phase: "saving", name: file.name });

      // Scored only when the file had a layout to measure. A score derived
      // from our transcription of a photograph would be a number about us.
      let atsScore: number | undefined;
      let atsResult: unknown;
      if (read.facts) {
        try {
          const { analyseResume } = await import("@/lib/tools/ats");
          const result = analyseResume(read.facts);
          atsScore = result.score;
          atsResult = result;
        } catch {
          /* The resume is still worth saving without a score. */
        }
      }

      try {
        const res = await fetch("/api/app/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.name.split(".").pop()?.toLowerCase(),
            text: read.text,
            atsScore,
            atsResult,
            // They handed this one over just now; it is the one to talk about.
            primary: true,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not save that.");
      } catch (e) {
        setAttachment({
          phase: "error",
          name: file.name,
          message: e instanceof Error ? e.message : "Could not save that file.",
        });
        return;
      }

      setAttachment(null);

      const opener = read.read
        ? `I've attached my resume (${file.name}). It's a ${read.kind}, so you had to read the pages — take a look.`
        : `I've attached my resume (${file.name}). Take a look.`;

      // Mid-call, the session's instructions were baked before this file
      // existed, so the resume has to be handed over in the conversation
      // itself. Sending only the opener would have it answer about a document
      // it cannot see — which is the mismatch this whole change is about.
      if (session.current?.live) {
        session.current.send(
          `${opener}\n\nHere is what it says, so you can talk about it now:\n${read.text.slice(0, 6000)}`,
        );
        setTurns((t) => [...t, { role: "user", text: opener, spoken: true }]);
        keep([{ role: "user", text: opener, spoken: true }], { channel: "voice" });
        return;
      }

      // The agent now has it in front of it. Opening the conversation rather
      // than leaving a chip sitting there is the whole point of dropping a
      // file into a chat.
      await send(opener);
    },
    // `send` is declared below and is stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy],
  );

  const pick = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (file) void attach(file);
  }, [attach]);

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

  /**
   * The one line under the input.
   *
   * Says nothing until there is something worth saying. Counting down from
   * ten on somebody's first message makes a free tier feel like a trap; the
   * number appears when it starts to matter and when it has run out.
   */
  /** Connecting counts as being in a call: the screen must not flicker back. */
  const inCall = listening || connecting;

  /**
   * One line, whoever is speaking.
   *
   * Live text wins over settled text, because during a call the interesting
   * thing is always the sentence in progress. When nobody is mid-sentence the
   * agent's last answer stays up, so the screen is never blank between turns.
   */
  const captionIsMine = !saying && !!heard;
  const caption =
    saying ||
    heard ||
    [...turns].reverse().find((t) => t.role === "model")?.text ||
    "";

  /** The most recent set of cards, for the call screen. */
  const lastCards = (() => {
    const t = [...turns].reverse().find((x) => x.jobs?.length);
    return t ? { jobs: t.jobs!, reason: t.reason } : null;
  })();

  const footnote = (() => {
    if (listening) {
      const mins = voiceLeft === null ? null : Math.floor(voiceLeft / 60);
      return mins !== null && mins <= 2
        ? `About ${Math.max(1, mins)} min of voice left.`
        : null;
    }
    if (upgrade) return null; // the error line already carries it
    if (!metered) return null; // nothing to count, and the error line says why
    if (messagesLeft !== null && messagesLeft <= 3) {
      return messagesLeft === 0
        ? "No messages left today."
        : `${messagesLeft} message${messagesLeft === 1 ? "" : "s"} left today.`;
    }
    return null;
  })();

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

      {/* Opened only by a tool result. Sits above the conversation because on
          a phone there is no beside — the resume takes the screen while you
          look at it, and Escape or the close button gives it back. */}
      <ResumePanel open={showResume} revision={revision} onClose={() => setShowResume(false)} />

      {/* Over the conversation rather than instead of it: the call keeps
          running while somebody types, which is the whole point of asking in
          writing rather than making them spell an email out loud. */}
      {form && (
        <ManualInput
          fields={form.fields}
          reason={form.reason}
          onSubmit={submitForm}
          onDismiss={() => setForm(null)}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cheatcode agent"
        // The whole screen is the drop target. A 200px dashed rectangle is a
        // thing you have to aim at; a screen is a thing you let go over.
        onDragEnter={(e) => {
          if (!e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer?.files?.length) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
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
        {/* While a file is over the window. Covers everything, including the
            call screen, because dropping a resume mid-call is a reasonable
            thing to do and refusing it would be a rule with no reason. */}
        {dragging && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-paper/92 backdrop-blur-[3px]">
            <div className="pointer-events-none flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ink-30 px-10 py-9">
              <ClipMark className="h-7 w-7 text-ink-50" />
              <p className="text-[1rem] font-medium text-ink">Drop it here</p>
              <p className="max-w-[26ch] text-center text-[0.8rem] leading-relaxed text-ink-30">
                PDF, Word, ODT, RTF, text — or a photo of it.
              </p>
            </div>
          </div>
        )}

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

        {/* Not during a call: the call screen already says what it is, in
            larger type, four lines below. Two labels saying the same thing is
            how a screen starts to feel unconsidered. */}
        {!empty && !inCall && (
          <div className="absolute left-5 top-5 z-10 flex items-center gap-2.5 sm:left-7 sm:top-7">
            <OrbMark className="h-6 w-6" />
            <span className="text-[0.78rem] font-medium tracking-[-0.01em] text-ink-50">
              Cheatcode agent
            </span>
          </div>
        )}

        {/* One input for the paperclip in either screen. `accept` is generous
            on purpose: the reader works out what a file is from its bytes, and
            a narrow accept list is how somebody with a .odt concludes the
            product cannot read their resume. */}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.odt,.rtf,.txt,.md,.html,.csv,image/*"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files);
            // So the same file can be picked twice in a row.
            e.target.value = "";
          }}
        />

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
          {inCall ? (
            /* ------------------------------------------------------- a call */
            <div className="flex h-full flex-col items-center justify-center pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <BigOrb listening={listening} busy={connecting} level={level} />

              <p className="mt-7 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-ink-30">
                {connecting ? "Connecting" : muted ? "Muted" : "On a call"}
              </p>
              {/* Tabular numerals so the seconds do not shuffle the minutes
                  sideways every tick. */}
              <p className="mt-1.5 text-[1.7rem] font-semibold tabular-nums tracking-[-0.02em] text-ink">
                {clock(callSeconds)}
              </p>

              {/* One caption, whoever is speaking. Two columns of transcript
                  during a call is a chat window with audio bolted on; a call
                  shows the last thing said and gets out of the way. */}
              <div className="mt-8 flex min-h-[5.5rem] w-full max-w-[34rem] items-start justify-center px-2">
                {caption ? (
                  <p
                    className={`line-clamp-4 text-center text-[1rem] leading-relaxed ${
                      captionIsMine ? "text-ink-50" : "text-ink"
                    }`}
                  >
                    {captionIsMine && (
                      <span className="mr-1.5 text-[0.72rem] uppercase tracking-[0.12em] text-ink-30">
                        You
                      </span>
                    )}
                    {caption}
                  </p>
                ) : (
                  <p className="text-center text-[0.9rem] leading-relaxed text-ink-30">
                    {connecting
                      ? "Getting the line ready…"
                      : muted
                        ? "You are muted. It cannot hear you."
                        : "Talk normally. Interrupt whenever you like — it stops when you start."}
                  </p>
                )}
              </div>

              {/* Cards still land during a call, because a voice cannot hand
                  over a link. Only the most recent set: a call is not a place
                  to scroll. */}
              {!!lastCards?.jobs.length && (
                <div className="w-full max-w-[34rem]">
                  <Cards jobs={lastCards.jobs} reason={lastCards.reason} center />
                </div>
              )}

              {typing && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(value);
                  }}
                  className="mt-7 flex w-full max-w-[34rem] items-center gap-2 rounded-2xl border border-ink-15 bg-paper p-1.5 pl-4 focus-within:border-ink-30"
                >
                  <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Type it instead — the answer still comes back aloud"
                    aria-label="Type to the agent during the call"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-[0.95rem] text-ink outline-none placeholder:text-ink-30"
                  />
                  <button
                    type="submit"
                    disabled={value.trim().length < 2}
                    className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity disabled:opacity-30"
                  >
                    Send
                  </button>
                </form>
              )}

              {/* ------------------------------------------------- controls */}
              <div className="mt-9 flex items-center gap-7">
                <CallControl
                  label={muted ? "Unmute" : "Mute"}
                  active={muted}
                  disabled={connecting}
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    session.current?.setMuted(next);
                  }}
                >
                  {muted ? <MicOffMark /> : <MicMark />}
                </CallControl>

                <button
                  type="button"
                  onClick={() => session.current?.stop()}
                  aria-label="End the call"
                  className="grid h-16 w-16 place-items-center rounded-full bg-ink text-paper transition-transform hover:scale-[1.04] active:scale-[0.97]"
                >
                  <EndCallMark />
                </button>

                <CallControl
                  label={typing ? "Hide" : "Type"}
                  active={typing}
                  onClick={() => setTyping((t) => !t)}
                >
                  <KeyboardMark />
                </CallControl>
              </div>

              <div className="mt-6 w-full max-w-[30rem]">
                <AttachmentChip attachment={attachment} onDismiss={() => setAttachment(null)} />
              </div>

              {footnote && (
                <p className="mt-7 text-center text-[0.74rem] text-ink-30">{footnote}</p>
              )}

              {error && (
                <p className="mt-4 text-center text-[0.85rem] text-ink-50">{error}</p>
              )}
            </div>
          ) : (
            <>
          {empty && (
            <div
              className="cc-lift flex shrink-0 flex-col items-center pt-[13vh]"
              style={{ "--d": "180ms" } as React.CSSProperties}
            >
              <BigOrb listening={false} busy={busy} level={0} />

              <h2 className="mt-7 text-center text-[1.35rem] font-semibold leading-snug tracking-[-0.03em] sm:text-[1.6rem]">
                {heading}
              </h2>
              <p className="mt-2.5 max-w-[46ch] text-center text-[0.88rem] leading-relaxed text-ink-50">
                I can see your resume, your profile and every job open to you
                right now. Talk to me, or type.
              </p>

              {/* The call, as a first-class thing to do rather than a glyph in
                  the text box. Talking to it is the one thing this does that
                  a search box cannot, and it was the least visible control on
                  the screen. */}
              <button
                type="button"
                onClick={() => void startCall()}
                className="cc-lift mt-7 inline-flex items-center gap-2.5 rounded-full bg-ink px-5 py-3 text-[0.9rem] font-medium text-paper transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ "--d": "330ms" } as React.CSSProperties}
              >
                <MicMark />
                Talk to it
              </button>

              {callError ? (
                /* A call that refused. Said here, at the size of the thing it
                   is about — a grey line above the text box is where this used
                   to go, and it is why "it just exits" was the whole bug
                   report three times running. */
                <div className="mt-4 w-full max-w-[30rem] rounded-xl border border-ink-15 bg-ink-04 px-4 py-3 text-center">
                  <p className="text-[0.86rem] leading-relaxed text-ink">{callError}</p>
                  <button
                    type="button"
                    onClick={() => void startCall()}
                    className="mt-2 text-[0.8rem] font-medium text-ink underline underline-offset-4 hover:no-underline"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <p
                  className="cc-lift mt-2 text-[0.76rem] text-ink-30"
                  style={{ "--d": "360ms" } as React.CSSProperties}
                >
                  A real call — it hears you while it talks.
                </p>
              )}

              <div
                className="cc-lift mt-8 flex max-w-lg flex-wrap justify-center gap-2"
                style={{ "--d": "430ms" } as React.CSSProperties}
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

          {error && (
            <p className="mb-3 text-center text-[0.85rem] text-ink-50">
              {error}
              {/* The way out belongs next to the wall, not in a footnote three
                  lines below it. The first attempt put it in the footnote and
                  the footnote suppressed itself whenever the paywall was up,
                  so the link never rendered at all. */}
              {upgrade && (
                <>
                  {" "}
                  <a
                    href="/app/upgrade"
                    className="font-medium text-ink underline underline-offset-4 hover:no-underline"
                  >
                    See Pro
                  </a>
                </>
              )}
            </p>
          )}

          {/* ------------------------------------------------------- controls */}
          <div
            className="cc-lift shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            style={{ "--d": "300ms" } as React.CSSProperties}
          >
            <AttachmentChip attachment={attachment} onDismiss={() => setAttachment(null)} />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(value);
              }}
              className="flex items-center gap-2 rounded-2xl border border-ink-15 bg-paper p-1.5 pl-2 transition-colors focus-within:border-ink-30"
            >
              {/* A paperclip, where a paperclip is. The drop target covers the
                  whole screen, but nobody discovers a drop target — they look
                  for this. */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy || attachment?.phase === "reading" || attachment?.phase === "saving"}
                aria-label="Attach your resume"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink disabled:opacity-40"
              >
                <ClipMark />
              </button>

              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                // A screenshot on the clipboard is a file too, and pasting one
                // is what people try before they look for a button.
                onPaste={(e) => {
                  const file = Array.from(e.clipboardData?.files ?? [])[0];
                  if (file) {
                    e.preventDefault();
                    void attach(file);
                  }
                }}
                disabled={busy}
                placeholder="Ask anything, or attach your resume"
                aria-label="Ask the agent"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[0.95rem] text-ink outline-none placeholder:text-ink-30 disabled:opacity-70"
              />

              {/* Labelled, not a lone glyph. An unlabelled microphone inside a
                  text box reads as dictation — as if it will type your words
                  into the field — which is the opposite of what it does. */}
              <button
                type="button"
                onClick={() => void startCall()}
                aria-label="Start a call with the agent"
                className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2.5 text-[0.85rem] font-medium text-ink-50 transition-colors hover:bg-ink-04 hover:text-ink"
              >
                <MicMark />
                <span className="hidden sm:inline">Talk</span>
              </button>

              <button
                type="submit"
                disabled={busy || value.trim().length < 2}
                className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-[0.85rem] font-medium text-paper transition-opacity disabled:opacity-30"
              >
                Ask
              </button>
            </form>

            {/* What is left, and only when it is worth saying. A counter
                that is always on screen reads as a meter running; one that
                appears when it starts to matter reads as information. The
                explanatory line that used to live here was describing the
                mic button to people who had already pressed it. */}
            {footnote && (
              <p className="mt-3 text-center text-[0.74rem] text-ink-30">{footnote}</p>
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ attachment */

/**
 * The file, while it is being dealt with.
 *
 * Two waits with nothing to look at — pulling the text out, then saving and
 * parsing it — so it says which one it is in. A failure stays on the chip
 * rather than becoming a conversation error, because it is about the file:
 * the thing to do next is send a different one, not reword a question.
 */
function AttachmentChip({
  attachment,
  onDismiss,
}: {
  attachment: Attachment | null;
  onDismiss: () => void;
}) {
  if (!attachment) return null;

  return (
    <div
      className={`mb-3 flex items-start gap-3 rounded-xl border px-3.5 py-2.5 ${
        attachment.phase === "error" ? "border-ink-15 bg-ink-04" : "border-ink-08 bg-ink-04"
      }`}
    >
      <ClipMark className="mt-0.5 shrink-0 text-ink-30" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.84rem] font-medium text-ink">{attachment.name}</p>
        <p className="mt-0.5 text-[0.76rem] leading-relaxed text-ink-50">
          {attachment.phase === "reading" ? (
            <>
              Reading it
              <Dots />
            </>
          ) : attachment.phase === "saving" ? (
            <>
              Saving it to your profile
              <Dots />
            </>
          ) : (
            attachment.message
          )}
        </p>
      </div>
      {attachment.phase === "error" && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1 text-ink-30 transition-colors hover:text-ink"
        >
          <svg width="13" height="13" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

/** A paperclip. */
function ClipMark({ className }: { className?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M13.6 8.2 8.9 12.9a2.1 2.1 0 0 1-3-3l5.3-5.3a3.4 3.4 0 0 1 4.8 4.8l-5.3 5.3a4.7 4.7 0 0 1-6.7-6.6l4.6-4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ----------------------------------------------------------------- cards */

/** The jobs the agent put on screen, because a voice cannot hand over a link. */
function Cards({
  jobs,
  reason,
  center,
}: {
  jobs: JobCard[];
  reason?: string;
  /** Centred on the call screen, where everything else is. */
  center?: boolean;
}) {
  return (
    <div className={`mt-2.5 ${center ? "text-center" : ""}`}>
      {reason && <p className="mb-2 px-1 text-[0.78rem] text-ink-30">{reason}</p>}
      <ul className={`flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>
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

/** mm:ss. Hours are not a case this product has. */
function clock(total: number): string {
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * A round control on the call screen.
 *
 * Labelled underneath rather than by tooltip: a call is a place where people
 * reach for a button without reading it, and an unlabelled circle is a guess.
 */
function CallControl({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="group flex w-16 flex-col items-center gap-2 disabled:opacity-40"
    >
      <span
        className={`grid h-12 w-12 place-items-center rounded-full border transition-colors ${
          active
            ? "border-ink-30 bg-ink-08 text-ink"
            : "border-ink-15 text-ink-50 group-hover:border-ink-30 group-hover:text-ink"
        }`}
      >
        {children}
      </span>
      <span className="text-[0.68rem] leading-none text-ink-30">{label}</span>
    </button>
  );
}

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

/** The same microphone with a line through it, so muted reads at a glance. */
function MicOffMark() {
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
      <path d="M3.4 3.4l13.2 13.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A handset, tipped.
 *
 * The universally understood "hang up" shape, and worth keeping literal: this
 * is the one control somebody presses in a hurry.
 */
function EndCallMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <g transform="rotate(135 12 12)">
        <path
          d="M6.6 3.5c.7 0 1.3.5 1.5 1.2l.6 2.3c.1.6-.1 1.2-.6 1.5l-1.2.9a11 11 0 0 0 5.7 5.7l.9-1.2c.4-.5 1-.7 1.5-.6l2.3.6c.7.2 1.2.8 1.2 1.5v2.2c0 .9-.8 1.6-1.7 1.5C8.4 18.4 3.6 13.6 3.1 5.2 3 4.3 3.7 3.5 4.6 3.5z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

/** For typing mid-call. */
function KeyboardMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2.2" y="5" width="15.6" height="10" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.4 8h.01M8 8h.01M10.6 8h.01M13.2 8h.01M6.6 11h6.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
