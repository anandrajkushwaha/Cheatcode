import type { JobCard, ShowJobs } from "@/lib/app/agent-types";

/**
 * What a live conversation looks like from the outside.
 *
 * Two providers speak two different protocols — OpenAI Realtime over WebRTC,
 * Gemini Live over a WebSocket — and neither of them is a detail the overlay
 * should know about. So the protocol lives behind this interface and the
 * screen keeps one set of callbacks whichever one is running.
 *
 * The split exists because the alternative was a single class with a provider
 * flag threaded through the socket, the audio graph, the event parser and the
 * teardown. That version is always one forgotten branch away from a session
 * that half-closes.
 */

export type LiveState = "idle" | "connecting" | "live" | "closed";

export type LiveHandlers = {
  /** What they said, as the model heard it. Interim until `final`. */
  onUserText?: (text: string, final: boolean) => void;
  /** What the agent is saying, in text, alongside the audio. */
  onAgentText?: (text: string, final: boolean) => void;
  /** The agent asked for jobs to be put on screen. */
  onShowJobs?: (show: ShowJobs) => void;
  /**
   * The agent called a tool. Resolve with what it should be told.
   *
   * The transport waits for this before letting the model speak again, which
   * is a short silence in the middle of a call and the correct one: a tool
   * that changed somebody's resume has to have actually changed it before the
   * agent says it did. Handlers must not throw — a rejected promise here
   * would leave the model waiting for a result that never comes, which ends
   * the conversation.
   */
  onTool?: (name: string, args: unknown) => Promise<unknown>;
  onState?: (state: LiveState) => void;
  /** 0..1, for anything that should move while somebody is talking. */
  onLevel?: (level: number) => void;
  onError?: (message: string) => void;
  /**
   * Seconds the connection was open, and what the provider says it used.
   *
   * The usage half is the difference between a voice row that reads
   * `0 in · 0 out · $0` and one that reads what the call actually cost. Both
   * providers report per-response token counts on the wire — OpenAI on
   * `response.done`, Gemini as `usageMetadata` — and this used to drop them on
   * the floor, so voice was the one feature whose spend nobody could see.
   *
   * Still only a report from a browser, so the server clamps it. But a
   * bounded measurement beats a null, and it beats an estimate derived from
   * duration that would sit in the same column looking equally measured.
   */
  onEnded?: (seconds: number, usage?: LiveUsage) => void;
};

/** Tokens a live session used, accumulated across its responses. */
export type LiveUsage = {
  /** Text tokens in and out; audio is counted apart because it is dearer. */
  input: number;
  output: number;
  audioInput: number;
  audioOutput: number;
  /** Billed at a reduced rate. Reported so an estimate can be checked. */
  cachedInput: number;
  /** How many model responses these totals came from. */
  responses: number;
};

export function emptyUsage(): LiveUsage {
  return { input: 0, output: 0, audioInput: 0, audioOutput: 0, cachedInput: 0, responses: 0 };
}

const count = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;

/** The usage block OpenAI puts on `response.done`. */
export type RealtimeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_token_details?: { audio_tokens?: number; text_tokens?: number; cached_tokens?: number };
  output_token_details?: { audio_tokens?: number; text_tokens?: number };
};

/**
 * Fold one response's usage into the session total. Pure, so it can be tested.
 *
 * Two things it must get right, and both are silent when wrong:
 *
 * **Summing.** Realtime bills per response, so a session's cost is the sum
 * over responses. Taking the last block would report one turn's worth.
 *
 * **Not double-counting audio.** `input_tokens` is the total *including* the
 * audio tokens, so the text half is what remains after audio is subtracted.
 * Adding both would inflate a voice bill by counting its most expensive part
 * twice — an overstatement, which is just as unusable as losing it.
 */
export function foldRealtimeUsage(total: LiveUsage, u: RealtimeUsage | undefined): LiveUsage {
  if (!u) return total;
  const audioIn = count(u.input_token_details?.audio_tokens);
  const audioOut = count(u.output_token_details?.audio_tokens);
  return {
    audioInput: total.audioInput + audioIn,
    audioOutput: total.audioOutput + audioOut,
    input: total.input + Math.max(0, count(u.input_tokens) - audioIn),
    output: total.output + Math.max(0, count(u.output_tokens) - audioOut),
    cachedInput: total.cachedInput + count(u.input_token_details?.cached_tokens),
    responses: total.responses + 1,
  };
}

/** The `usageMetadata` Gemini Live puts on its messages. */
export type GeminiUsage = {
  promptTokenCount?: number;
  responseTokenCount?: number;
  totalTokenCount?: number;
  promptTokensDetails?: { modality?: string; tokenCount?: number }[];
  responseTokensDetails?: { modality?: string; tokenCount?: number }[];
};

/**
 * Take Gemini's totals, which are cumulative for the session already.
 *
 * This **replaces** rather than adds — the opposite of the OpenAI path, and
 * the reason both live here side by side where the difference is visible.
 * Summing a cumulative counter would multiply a session's cost by its number
 * of turns.
 */
export function takeGeminiUsage(total: LiveUsage, u: GeminiUsage | undefined): LiveUsage {
  if (!u) return total;
  const modality = (rows: { modality?: string; tokenCount?: number }[] | undefined, want: string) =>
    (rows ?? [])
      .filter((r) => (r.modality ?? "").toUpperCase() === want)
      .reduce((t, r) => t + count(r.tokenCount), 0);

  const audioIn = modality(u.promptTokensDetails, "AUDIO");
  const audioOut = modality(u.responseTokensDetails, "AUDIO");
  return {
    audioInput: audioIn,
    audioOutput: audioOut,
    input: Math.max(0, count(u.promptTokenCount) - audioIn),
    output: Math.max(0, count(u.responseTokenCount) - audioOut),
    cachedInput: total.cachedInput,
    responses: total.responses + 1,
  };
}

/** Everything a transport is given, and nothing it is not. */
export type TransportContext = {
  /** The microphone, already granted. Transports never ask for it themselves. */
  stream: MediaStream;
  /** An ephemeral credential minted server-side. Never a real API key. */
  token: string;
  model: string;
  /** Where to post the SDP offer. WebRTC only. */
  callsUrl?: string;
  on: LiveHandlers;
  /**
   * One line for the agent to open the call with, if any.
   *
   * A call that connects into silence makes everybody say "hello? can you hear
   * me?" first, which is a poor first ten seconds. This is composed
   * server-side from what we already know rather than generated, so it is one
   * short sentence and cannot wander.
   *
   * Absent when the call is continuing a conversation that is already on
   * screen: greeting somebody who has been typing to you for a minute is
   * worse than saying nothing.
   */
  opening?: string;
  /**
   * The connection died on its own rather than being closed by us.
   *
   * Separate from onError because the session has to be torn down and the
   * seconds reported, which is the coordinator's job, not the transport's.
   */
  onDropped: (reason: string) => void;
};

export interface Transport {
  /** Connect and be ready to talk. Throws if it cannot. */
  open(): Promise<void>;
  /** Type something mid-call. The answer still comes back as speech. */
  sendText(text: string): void;
  /** Release everything: sockets, peers, audio graphs, timers. */
  close(): void;
  /**
   * Tokens used so far, as the provider reported them.
   *
   * Read at the end of the call rather than pushed, because the session has
   * to read it during teardown — after the last `response.done` and before
   * the transport is dropped.
   */
  used(): LiveUsage;
}

export type Ticket = {
  ok?: boolean;
  provider?: "openai" | "gemini";
  token?: string;
  model?: string;
  callsUrl?: string;
  remaining?: number;
  jobs?: JobCard[];
  error?: string;
  upgrade?: boolean;
  /** False when this server has no limits table, so there is nothing to count. */
  configured?: boolean;
};
