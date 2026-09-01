import { GeminiTransport } from "@/lib/app/live-gemini";
import { OpenAITransport } from "@/lib/app/live-openai";
import type { JobCard } from "@/lib/app/agent-types";
import type { LiveHandlers, LiveState, Ticket, Transport } from "@/lib/app/live-types";

export type { LiveHandlers, LiveState } from "@/lib/app/live-types";

/**
 * A live conversation with the agent.
 *
 * Browser-side, and it has to be: a conversation is a connection held open
 * for its whole length, and a serverless function cannot hold one. So the
 * connection is opened here, with a credential minted server-side that
 * expires in minutes and carries the model, instructions and tools baked in
 * — this file never sees an API key and cannot change what the agent is.
 *
 * What lives here is everything that is the same whichever provider answers:
 * getting the microphone, fetching the ticket, the allowance timer, the state
 * machine, and tearing all of it down exactly once. The protocol itself lives
 * in live-openai.ts (WebRTC) and live-gemini.ts (WebSocket), and the ticket
 * says which one to build.
 */

export class LiveSession {
  private transport: Transport | null = null;
  private stream: MediaStream | null = null;

  private startedAt = 0;
  private budget = 0;
  private state: LiveState = "idle";
  private ending = false;

  /**
   * The jobs this session is allowed to put on screen.
   *
   * Sent down with the ticket, because a tool call that has to fetch its own
   * cards is a pause in the middle of somebody speaking. The model is given
   * these same ids in its instructions, so it can only name one of them.
   */
  jobs: JobCard[] = [];

  /** Seconds of voice this account had left when the session opened. */
  remaining: number | null = null;

  /** True when the refusal was a paywall rather than a fault. */
  upgrade = false;

  /** Which provider answered. Useful in a bug report, harmless otherwise. */
  provider: "openai" | "gemini" | null = null;

  constructor(private readonly on: LiveHandlers) {}

  get live(): boolean {
    return this.state === "live";
  }

  /* ------------------------------------------------------------- opening */

  async start(): Promise<void> {
    if (this.state !== "idle" && this.state !== "closed") return;
    this.set("connecting");

    // Microphone first. Asking for a ticket before knowing whether we can even
    // hear them spends a credential on a session that cannot happen.
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      this.fail("Microphone is blocked. Allow it in the address bar, or type instead.");
      return;
    }

    let ticket: Ticket;
    try {
      const res = await fetch("/api/app/agent/live-token", { method: "POST" });
      ticket = (await res.json()) as Ticket;
      if (!res.ok || !ticket.ok || !ticket.token) {
        this.upgrade = !!ticket.upgrade;
        this.fail(ticket.error ?? "Could not start a voice session.");
        return;
      }
    } catch {
      this.fail("Network trouble. Try again.");
      return;
    }

    this.jobs = Array.isArray(ticket.jobs) ? ticket.jobs : [];
    this.remaining = typeof ticket.remaining === "number" ? ticket.remaining : null;
    this.provider = ticket.provider ?? "gemini";

    const context = {
      stream: this.stream,
      token: ticket.token,
      model: ticket.model ?? "",
      callsUrl: ticket.callsUrl,
      on: this.on,
      onDropped: (reason: string) => {
        if (this.state === "live") this.stop(reason);
      },
    };

    this.transport =
      this.provider === "openai" ? new OpenAITransport(context) : new GeminiTransport(context);

    try {
      await this.transport.open();
    } catch (e) {
      console.error("live: could not open the connection —", String(e).slice(0, 200));
      // The transport may be half-built. Closing it is safe and skipping it
      // leaks a peer connection and a microphone for the life of the tab.
      this.transport.close();
      this.transport = null;
      this.fail("Could not open the voice connection.");
      return;
    }

    this.startedAt = Date.now();
    this.set("live");

    // Hang up on our own allowance rather than waiting for the connection to
    // be cut from outside. Ending on our terms means the seconds get reported
    // and the person gets a sentence, instead of the call simply dying.
    if (this.remaining !== null) {
      this.budget = window.setTimeout(
        () => this.stop("That's your voice time. Typing still works."),
        this.remaining * 1000,
      );
    }
  }

  /* ------------------------------------------------------------- closing */

  stop(reason?: string): void {
    if (this.ending) return;
    this.ending = true;

    const seconds = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;

    if (this.budget) {
      window.clearTimeout(this.budget);
      this.budget = 0;
    }

    this.transport?.close();
    this.transport = null;

    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;

    this.set("closed");
    if (reason) this.on.onError?.(reason);
    if (seconds > 0) this.on.onEnded?.(seconds);

    this.ending = false;
    this.startedAt = 0;
  }

  /** Type something mid-call. The answer still comes back as speech. */
  send(text: string): void {
    this.transport?.sendText(text);
  }

  private set(state: LiveState): void {
    this.state = state;
    this.on.onState?.(state);
  }

  private fail(message: string): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.set("closed");
    this.on.onError?.(message);
  }
}
