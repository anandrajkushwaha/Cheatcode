import { readShowJobs } from "@/lib/app/agent-types";
import {
  emptyUsage,
  takeGeminiUsage,
  type GeminiUsage,
  type LiveUsage,
  type Transport,
  type TransportContext,
} from "@/lib/app/live-types";

/**
 * A live conversation over Gemini's Live API.
 *
 * A WebSocket carrying JSON both ways, with audio base64'd inside it. The
 * token was minted server-side and carries the model, instructions and tools,
 * so this file never sees an API key and cannot change what the agent is.
 *
 * Two audio contexts rather than one, because they run at different rates and
 * asking the browser to resample either way is worse than letting it pick:
 *
 *   capture  16kHz  mic → worklet → Int16 → base64 → socket
 *   playback 24kHz  socket → base64 → Int16 → Float32 → scheduled buffers
 *
 * Playback schedules each chunk against a running cursor rather than playing
 * it on arrival. Audio arrives in bursts over a network; playing on arrival is
 * how you get a voice that stutters even though every byte turned up.
 *
 * All of this is why the OpenAI transport is shorter: WebRTC does the audio.
 */

const WS_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

const CAPTURE_RATE = 16_000;
const PLAYBACK_RATE = 24_000;

export class GeminiTransport implements Transport {
  private ws: WebSocket | null = null;
  private capture: AudioContext | null = null;
  private playback: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;

  /** Where the next chunk of the agent's voice belongs on the timeline. */
  private cursor = 0;
  private closed = false;

  private userBuf = "";
  private agentBuf = "";

  /** Running total of what the provider says this session has used. */
  private usage = emptyUsage();

  constructor(private readonly ctx: TransportContext) {}

  async open(): Promise<void> {
    await this.openSocket();
    await this.openMic();
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_BASE}?access_token=${encodeURIComponent(this.ctx.token)}`);
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      const giveUp = window.setTimeout(() => reject(new Error("timeout")), 12_000);

      ws.onopen = () => {
        window.clearTimeout(giveUp);
        // Everything that shapes the session — instructions, tools, modality,
        // transcription — is already inside the token's constraints. Naming
        // the model here is all that is left, and it has to match.
        ws.send(JSON.stringify({ setup: { model: `models/${this.ctx.model}` } }));
        resolve();
      };

      ws.onmessage = (e) => void this.receive(e.data);

      ws.onerror = () => {
        window.clearTimeout(giveUp);
        reject(new Error("socket"));
      };

      ws.onclose = () => {
        if (!this.closed) this.ctx.onDropped("The voice connection dropped.");
      };
    });
  }

  private async openMic(): Promise<void> {
    // Asking the context for 16kHz rather than resampling by hand. Browsers
    // have a better resampler than anything worth writing here, and this is
    // the rate the API wants.
    const ctx = new AudioContext({ sampleRate: CAPTURE_RATE });
    this.capture = ctx;

    await ctx.audioWorklet.addModule("/agent-capture.js");

    const source = ctx.createMediaStreamSource(this.ctx.stream);
    const node = new AudioWorkletNode(ctx, "cc-capture");
    this.worklet = node;

    node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; peak: number }>) => {
      this.ctx.on.onLevel?.(Math.min(1, e.data.peak * 3));
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: { data: base64(e.data.pcm), mimeType: `audio/pcm;rate=${CAPTURE_RATE}` },
          },
        }),
      );
    };

    source.connect(node);
    // The worklet returns silence, but a node with no destination is not
    // pulled by the graph at all, so nothing would ever reach it.
    node.connect(ctx.destination);
  }

  /* ------------------------------------------------------------ incoming */

  private async receive(raw: unknown): Promise<void> {
    let text: string;
    if (typeof raw === "string") text = raw;
    else if (raw instanceof Blob) text = await raw.text();
    else if (raw instanceof ArrayBuffer) text = new TextDecoder().decode(raw);
    else return;

    let msg: LiveMessage;
    try {
      msg = JSON.parse(text) as LiveMessage;
    } catch {
      return;
    }

    // The model wants jobs on screen. Answered without a round trip to our
    // server: the cards are already in the client, and a tool call that waits
    // on a fetch is a pause in the middle of somebody speaking.
    if (msg.toolCall?.functionCalls?.length) {
      for (const call of msg.toolCall.functionCalls) {
        if (call.name === "show_jobs") {
          const show = readShowJobs(call.args);
          if (show) this.ctx.on.onShowJobs?.(show);
        }
      }
      this.ws?.send(
        JSON.stringify({
          toolResponse: {
            functionResponses: msg.toolCall.functionCalls.map((c) => ({
              id: c.id,
              name: c.name,
              response: { result: "shown" },
            })),
          },
        }),
      );
    }

    // Gemini reports usage on the message rather than on a response event, and
    // reports the running total for the session rather than a per-turn delta —
    // so this replaces rather than adds. Summing it, as the OpenAI path must,
    // would multiply the session's cost by its number of turns.
    this.addUsage(msg.usageMetadata);

    const server = msg.serverContent;
    if (!server) return;

    if (server.inputTranscription?.text) {
      this.userBuf += server.inputTranscription.text;
      this.ctx.on.onUserText?.(this.userBuf, false);
    }

    if (server.outputTranscription?.text) {
      this.agentBuf += server.outputTranscription.text;
      this.ctx.on.onAgentText?.(this.agentBuf, false);
    }

    for (const part of server.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (data && part.inlineData?.mimeType?.startsWith("audio/")) this.play(data);
    }

    // They started talking over the agent. Everything already scheduled is the
    // agent's old answer, and playing it under their interruption is the single
    // most irritating thing a voice product does.
    if (server.interrupted) this.flush();

    if (server.turnComplete) {
      if (this.userBuf) {
        this.ctx.on.onUserText?.(this.userBuf, true);
        this.userBuf = "";
      }
      if (this.agentBuf) {
        this.ctx.on.onAgentText?.(this.agentBuf, true);
        this.agentBuf = "";
      }
    }
  }

  /* ------------------------------------------------------------ playback */

  private play(b64: string): void {
    if (!this.playback) this.playback = new AudioContext({ sampleRate: PLAYBACK_RATE });
    const ctx = this.playback;

    const bytes = unbase64(b64);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    if (!pcm.length) return;

    const buffer = ctx.createBuffer(1, pcm.length, PLAYBACK_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    // A small lead so a late chunk does not get scheduled in the past, which
    // the browser handles by playing it immediately — and two chunks playing
    // at once is a garble, not a delay.
    const now = ctx.currentTime;
    if (this.cursor < now + 0.04) this.cursor = now + 0.08;
    src.start(this.cursor);
    this.cursor += buffer.duration;
  }

  /** Drop everything queued but not yet heard. */
  private flush(): void {
    if (!this.playback) return;
    const ctx = this.playback;
    this.playback = null;
    this.cursor = 0;
    void ctx.close();
    this.agentBuf = "";
  }

  /* ------------------------------------------------------------- closing */

  sendText(text: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ realtimeInput: { text } }));
  }

  /** What this session has cost so far, in tokens. Read when the call ends. */
  used(): LiveUsage {
    return { ...this.usage };
  }

  private addUsage(u: GeminiUsage | undefined): void {
    this.usage = takeGeminiUsage(this.usage, u);
  }

  close(): void {
    this.closed = true;

    this.worklet?.port.close();
    this.worklet?.disconnect();
    this.worklet = null;

    void this.capture?.close();
    this.capture = null;

    this.flush();

    if (this.ws && this.ws.readyState <= WebSocket.OPEN) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
  }
}

/* ----------------------------------------------------------------- wire */

type LiveMessage = {
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  toolCall?: {
    functionCalls?: { id?: string; name?: string; args?: Record<string, unknown> }[];
  };
  usageMetadata?: GeminiUsage;
};

function base64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  // In chunks: String.fromCharCode.apply on a 100k array throws in Safari.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function unbase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
