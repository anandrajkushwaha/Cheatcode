"use client";

/**
 * Speech to text, using the browser's own recogniser.
 *
 * Deliberately not a server transcription API. Most answers here are a minute
 * of speech, and sending every one to Whisper would put a per-answer cost on
 * the part of the feature that should feel free, and add a wait between
 * finishing a sentence and seeing it. The browser's recogniser is instant and
 * costs nothing. Its price is coverage — Chrome, Edge and Safari; Firefox has
 * nothing — so the button hides itself where it is unavailable.
 *
 * ------------------------------------------------- why permission comes first
 *
 * The first version called recognition.start() straight from the click. On a
 * browser that had not been granted the microphone yet, Chrome fired
 * `not-allowed` immediately, *then* showed its permission prompt — so the
 * first press always failed with "access was blocked" even as the person was
 * clicking Allow, and only the second press worked. That is the bug.
 *
 * So permission is requested explicitly with getUserMedia and awaited before
 * recognition starts. The track is stopped the moment it is granted; we only
 * ever wanted the answer to the question, not the audio. SpeechRecognition
 * does not require a user gesture, only permission, so awaiting first is safe.
 *
 * ------------------------------------------------------ why it restarts
 *
 * Chrome ends a session after a few seconds of silence even with
 * `continuous = true`. Somebody pausing to think would find dictation had
 * quietly died mid-answer, which reads as a broken button. So it restarts
 * itself — after a short delay, because restarting synchronously inside
 * `onend` throws — and gives up only after several restarts that heard
 * nothing at all, so a forgotten open microphone does not run forever.
 */

type Listener = {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative; length: number };
type RecognitionEvent = {
  resultIndex: number;
  results: { length: number } & Record<number, RecognitionResult>;
};
type RecognitionErrorEvent = { error: string };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictationSupported(): boolean {
  return ctor() !== null;
}

/**
 * Instagram's and Facebook's browsers have no speech recognition and no
 * address bar, so both the feature and the usual advice about the microphone
 * icon are wrong there. Worth saying what actually works instead.
 */
export function inAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS/i.test(navigator.userAgent || "");
}

const MESSAGES: Record<string, string> = {
  "not-allowed":
    "Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again — or keep typing.",
  "service-not-allowed":
    "Your browser would not start the microphone. Keep typing instead.",
  "audio-capture": "No microphone found. Keep typing instead.",
  network: "The speech service could not be reached. Keep typing instead.",
};

export type Dictation = { stop: () => void };

/** Give up after this many restarts in a row that produced no words. */
const MAX_SILENT_RESTARTS = 4;

export async function startDictation(listener: Listener): Promise<Dictation | null> {
  const Ctor = ctor();
  if (!Ctor) return null;

  // Permission first — see the note at the top of the file.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    listener.onError(
      name === "NotAllowedError" || name === "SecurityError"
        ? MESSAGES["not-allowed"]
        : name === "NotFoundError"
          ? MESSAGES["audio-capture"]
          : "Could not open the microphone. Keep typing instead.",
    );
    return null;
  }

  const rec = new Ctor();
  // en-IN rather than en-US: it is the difference between a recogniser that
  // hears Indian names, places and companies and one that does not.
  rec.lang = "en-IN";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let wanted = true;
  let silentRestarts = 0;
  let heardSinceStart = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  rec.onstart = () => {
    heardSinceStart = false;
  };

  rec.onresult = (event) => {
    let settled = "";
    let guess = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? "";
      if (result?.isFinal) settled += text;
      else guess += text;
    }
    if (settled.trim() || guess.trim()) {
      heardSinceStart = true;
      silentRestarts = 0;
    }
    if (settled.trim()) listener.onFinal(settled);
    listener.onInterim(guess);
  };

  rec.onerror = (event) => {
    // "no-speech" and "aborted" are ordinary events in a long answer, not
    // failures worth interrupting somebody with — onend will restart.
    if (event.error === "no-speech" || event.error === "aborted") return;
    wanted = false;
    listener.onError(MESSAGES[event.error] ?? "Dictation stopped. Keep typing instead.");
  };

  rec.onend = () => {
    if (!wanted) {
      listener.onEnd();
      return;
    }

    if (!heardSinceStart) silentRestarts += 1;
    if (silentRestarts >= MAX_SILENT_RESTARTS) {
      wanted = false;
      listener.onEnd();
      return;
    }

    // Not synchronous: Chrome throws InvalidStateError if start() is called
    // from inside its own onend.
    restartTimer = setTimeout(() => {
      if (!wanted) return;
      try {
        rec.start();
      } catch {
        wanted = false;
        listener.onEnd();
      }
    }, 250);
  };

  try {
    rec.start();
  } catch {
    listener.onError("Dictation could not start. Keep typing instead.");
    return null;
  }

  return {
    stop: () => {
      wanted = false;
      if (restartTimer) clearTimeout(restartTimer);
      try {
        rec.stop();
      } catch {
        /* Already stopped. */
      }
    },
  };
}
