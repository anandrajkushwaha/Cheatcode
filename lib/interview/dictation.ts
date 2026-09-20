"use client";

/**
 * Speech to text, using the browser's own recogniser.
 *
 * Deliberately not a server transcription API. Most answers here are a
 * minute of speech, and sending every one of them to Whisper would put a
 * per-answer cost on the one part of the feature that ought to feel free —
 * and add a wait between finishing a sentence and seeing it. The browser's
 * recogniser is instant, costs nothing, and streams as you talk.
 *
 * Its price is coverage: this is a Chrome and Edge API, plus Safari under a
 * prefix. Firefox has nothing. So the button is hidden rather than broken
 * where it is unavailable, and typing is always there.
 *
 * The transcript is handed back in two parts. `final` is settled text that
 * should be appended to the answer; `interim` is the recogniser's current
 * guess, which changes on almost every word and must be shown separately or
 * the textarea flickers as it rewrites itself.
 */

type Listener = {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative; length: number };
type RecognitionEvent = { resultIndex: number; results: { length: number } & Record<number, RecognitionResult> };
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

const MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's address bar, or keep typing.",
  "service-not-allowed": "Your browser would not start the microphone. Keep typing instead.",
  "audio-capture": "No microphone found. Keep typing instead.",
  network: "The speech service could not be reached. Keep typing instead.",
};

export function startDictation(listener: Listener): { stop: () => void } | null {
  const Ctor = ctor();
  if (!Ctor) return null;

  const rec = new Ctor();
  // en-IN, not en-US: it is the difference between a recogniser that hears
  // Indian place names and company names and one that does not.
  rec.lang = "en-IN";
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  // Chrome stops listening after a pause even with continuous = true. Unless
  // the person pressed stop, restart it — otherwise dictation dies silently
  // mid-thought, which reads as the button not working.
  let wanted = true;

  rec.onresult = (event) => {
    let settled = "";
    let guess = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? "";
      if (result?.isFinal) settled += text;
      else guess += text;
    }
    if (settled) listener.onFinal(settled);
    listener.onInterim(guess);
  };

  rec.onerror = (event) => {
    // "no-speech" and "aborted" are ordinary events, not failures worth
    // interrupting somebody with.
    if (event.error === "no-speech" || event.error === "aborted") return;
    wanted = false;
    listener.onError(MESSAGES[event.error] ?? "Dictation stopped. Keep typing instead.");
  };

  rec.onend = () => {
    if (!wanted) {
      listener.onEnd();
      return;
    }
    try {
      rec.start();
    } catch {
      wanted = false;
      listener.onEnd();
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      wanted = false;
      try {
        rec.stop();
      } catch {
        /* Already stopped. */
      }
    },
  };
}
