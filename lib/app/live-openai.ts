import { readShowJobs } from "@/lib/app/agent-types";
import type { Transport, TransportContext } from "@/lib/app/live-types";

/**
 * A live conversation over OpenAI's Realtime API.
 *
 * WebRTC rather than a WebSocket, which is the whole reason this file is
 * shorter than the Gemini one: the microphone goes out as a media track and
 * the agent's voice comes back as a media track, so there is no PCM to
 * encode, no base64, and no playback scheduling. The browser's own jitter
 * buffer does the job the cursor in live-gemini.ts does by hand, and does it
 * better.
 *
 * A single data channel, "oai-events", carries JSON both ways: transcripts
 * down, typed messages and tool results up.
 *
 * The credential is an ephemeral client secret minted server-side. Every
 * constraint — model, instructions, tools, voice, turn detection — is already
 * baked into it, so this file never sees an API key and cannot change what
 * the agent is or what it costs.
 */

export class OpenAITransport implements Transport {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audio: HTMLAudioElement | null = null;

  /** Level metering, which WebRTC does not give us for free. */
  private meter: AudioContext | null = null;
  private raf = 0;

  private closed = false;
  private userBuf = "";
  private agentBuf = "";

  /**
   * Tool calls seen but not yet answered.
   *
   * Cards go on screen the moment the arguments finish streaming, because
   * that is a second earlier than waiting for the whole response and a second
   * is visible. The result is submitted later, at `response.done` — sending
   * it while a response is still running is rejected as an active response,
   * which would turn a working tool call into an error nobody can see.
   */
  private pending = new Map<string, string>();
  private shown = new Set<string>();

  constructor(private readonly ctx: TransportContext) {}

  async open(): Promise<void> {
    const pc = new RTCPeerConnection();
    this.pc = pc;

    // The agent's voice. An <audio> element rather than the Web Audio graph:
    // it is one line, and it lets the browser handle jitter and device
    // changes, which is most of what makes a call sound stable.
    pc.ontrack = (e) => {
      const el = new Audio();
      el.autoplay = true;
      el.srcObject = e.streams[0];
      this.audio = el;
      void el.play().catch(() => {
        // Autoplay was refused. The only way into this screen is a press, so
        // this should not happen — but silence with no explanation is the
        // worst outcome, so say it rather than swallowing it.
        this.ctx.on.onError?.("The browser blocked the audio. Reload and try again.");
      });
    };

    for (const track of this.ctx.stream.getAudioTracks()) pc.addTrack(track, this.ctx.stream);

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (e) => this.receive(e.data);

    pc.onconnectionstatechange = () => {
      if (this.closed) return;
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.ctx.onDropped("The voice connection dropped.");
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // There is no signalling channel to trickle candidates over — the offer is
    // posted once as a whole — so it has to carry them. Host candidates gather
    // in a few milliseconds; the timeout is only there so a machine with a
    // stuck network interface fails in three seconds rather than never.
    await gathered(pc, 3_000);

    const res = await fetch(this.ctx.callsUrl ?? "https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.ctx.token}`,
        "Content-Type": "application/sdp",
      },
      body: pc.localDescription?.sdp ?? offer.sdp ?? "",
    });

    if (!res.ok) {
      // The body is OpenAI's own explanation and it is the only useful thing
      // here. It goes to the console in full; the person gets the status,
      // because "could not open the voice connection" for every possible
      // cause is what made this impossible to debug from a screenshot.
      const body = await res.text().catch(() => "");
      console.error("live: realtime call refused", res.status, body.slice(0, 600));
      throw new Error(`The voice service refused the call (${res.status}).`);
    }

    const answer = await res.text();
    if (!/^v=0/.test(answer.trim())) {
      // A 200 that is not an SDP means something in front of us answered
      // instead — a proxy, a captive portal, an extension.
      console.error("live: answer was not an SDP", answer.slice(0, 300));
      throw new Error("The voice service sent something unexpected back.");
    }

    try {
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (e) {
      console.error("live: setRemoteDescription failed —", String(e).slice(0, 300));
      throw new Error("This browser refused the voice connection.");
    }

    await opened(dc, 12_000);

    this.startMeter();
    this.openWith();
  }

  /**
   * Speak first, in one line.
   *
   * The line itself is decided server-side and handed over whole; the model is
   * told to say it and stop. Left to its own devices it opens with a paragraph
   * introducing its capabilities, which is the tone of a hold message — and
   * `max_output_tokens` is the belt to the instruction's braces, because a
   * model that decides to elaborate is a model talking over somebody's first
   * sentence.
   */
  private openWith(): void {
    const line = this.ctx.opening?.trim();
    if (!line || this.dc?.readyState !== "open") return;

    this.dc.send(
      JSON.stringify({
        type: "response.create",
        response: {
          instructions:
            `Say exactly this and nothing else, then stop and listen: "${line}"`,
          max_output_tokens: 80,
        },
      }),
    );
  }

  /* -------------------------------------------------------------- meter */

  /**
   * How loud they are, 0..1.
   *
   * The Gemini path gets this free from the capture worklet it needs anyway.
   * Here the microphone never passes through our own audio graph, so it is
   * tapped separately — read-only, connected to nothing, so it cannot feed
   * back into the call.
   */
  private startMeter(): void {
    try {
      const ac = new AudioContext();
      this.meter = ac;
      const source = ac.createMediaStreamSource(this.ctx.stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const frame = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(frame);
        let peak = 0;
        for (let i = 0; i < frame.length; i++) {
          const v = Math.abs(frame[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        this.ctx.on.onLevel?.(Math.min(1, peak * 3));
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    } catch {
      // A missing level meter is a still orb, not a broken call.
    }
  }

  /* ------------------------------------------------------------ incoming */

  private receive(raw: unknown): void {
    if (typeof raw !== "string") return;

    let msg: RealtimeEvent;
    try {
      msg = JSON.parse(raw) as RealtimeEvent;
    } catch {
      return;
    }

    switch (msg.type) {
      /* ---- what they said */
      case "conversation.item.input_audio_transcription.delta":
        this.userBuf += msg.delta ?? "";
        this.ctx.on.onUserText?.(this.userBuf, false);
        break;

      case "conversation.item.input_audio_transcription.completed":
        this.ctx.on.onUserText?.(msg.transcript ?? this.userBuf, true);
        this.userBuf = "";
        break;

      /* ---- what the agent is saying */
      case "response.output_audio_transcript.delta":
        this.agentBuf += msg.delta ?? "";
        this.ctx.on.onAgentText?.(this.agentBuf, false);
        break;

      case "response.output_audio_transcript.done":
        if (this.agentBuf || msg.transcript) {
          this.ctx.on.onAgentText?.(msg.transcript ?? this.agentBuf, true);
        }
        this.agentBuf = "";
        break;

      /* ---- they talked over it */
      case "input_audio_buffer.speech_started":
        // WebRTC stops the agent's audio server-side; this only clears the
        // half-finished line so the screen does not keep a sentence that was
        // never heard.
        this.agentBuf = "";
        break;

      /* ---- tools */
      case "response.function_call_arguments.done":
        if (msg.call_id) {
          this.pending.set(msg.call_id, msg.arguments ?? "{}");
          this.show(msg.call_id, msg.name, msg.arguments);
        }
        break;

      case "response.done":
        for (const item of msg.response?.output ?? []) {
          if (item.type !== "function_call" || !item.call_id) continue;
          this.pending.set(item.call_id, item.arguments ?? "{}");
          this.show(item.call_id, item.name, item.arguments);
        }
        this.answerCalls();
        break;

      case "error":
        console.error("live: realtime error", JSON.stringify(msg.error).slice(0, 300));
        break;
    }
  }

  /** Put the cards on screen, once per call. */
  private show(callId: string, name?: string, args?: string): void {
    if (name !== "show_jobs" || this.shown.has(callId)) return;
    this.shown.add(callId);
    try {
      const show = readShowJobs(JSON.parse(args ?? "{}"));
      if (show) this.ctx.on.onShowJobs?.(show);
    } catch {
      console.warn("live: unparseable show_jobs arguments");
    }
  }

  /**
   * Tell the model its tool ran, then let it carry on talking.
   *
   * The cards are already in the client, so there is nothing to fetch — which
   * matters, because a tool call that waits on a round trip is a pause in the
   * middle of somebody speaking.
   */
  private answerCalls(): void {
    if (!this.pending.size || this.dc?.readyState !== "open") return;

    for (const callId of this.pending.keys()) {
      this.dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ result: "shown" }),
          },
        }),
      );
    }
    this.pending.clear();

    // One response for however many calls were just answered. Two would have
    // the agent say the same thing twice.
    this.dc.send(JSON.stringify({ type: "response.create" }));
  }

  /* ------------------------------------------------------------- outgoing */

  sendText(text: string): void {
    if (this.dc?.readyState !== "open") return;
    this.dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      }),
    );
    this.dc.send(JSON.stringify({ type: "response.create" }));
  }

  /* -------------------------------------------------------------- closing */

  close(): void {
    this.closed = true;

    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;

    void this.meter?.close();
    this.meter = null;

    if (this.audio) {
      this.audio.pause();
      // Both, in this order: dropping srcObject without pausing leaves the
      // element decoding a stream nobody is listening to.
      this.audio.srcObject = null;
      this.audio = null;
    }

    try {
      this.dc?.close();
    } catch {
      /* already gone */
    }
    this.dc = null;

    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.ontrack = null;
      this.pc.close();
    }
    this.pc = null;
  }
}

/* ---------------------------------------------------------------- waits */

/** Resolve when the SDP has all the candidates it is going to get. */
function gathered(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      window.clearTimeout(timer);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const timer = window.setTimeout(done, timeoutMs);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

/** Resolve when the data channel is usable, reject if it never becomes so. */
function opened(dc: RTCDataChannel, timeoutMs: number): Promise<void> {
  if (dc.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("The call connected but never opened. Check the network.")),
      timeoutMs,
    );
    dc.onopen = () => {
      window.clearTimeout(timer);
      resolve();
    };
    dc.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("The call's data channel failed to open."));
    };
  });
}

/* ----------------------------------------------------------------- wire */

type RealtimeEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  error?: unknown;
  response?: {
    output?: { type?: string; name?: string; call_id?: string; arguments?: string }[];
  };
};
