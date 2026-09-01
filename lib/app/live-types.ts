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
  onState?: (state: LiveState) => void;
  /** 0..1, for anything that should move while somebody is talking. */
  onLevel?: (level: number) => void;
  onError?: (message: string) => void;
  /** Seconds the connection was open. The server bills against this. */
  onEnded?: (seconds: number) => void;
};

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
};
