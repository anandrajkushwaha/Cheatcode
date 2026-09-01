import "server-only";
import { TOOLS } from "@/lib/app/agent-brain";
import { toolsForOpenAI } from "@/lib/app/llm";
import { discoverModel, pinned, preferredModel, rememberModel } from "@/lib/app/gemini-models";
import {
  discoverOpenAIModel,
  pinnedOpenAI,
  preferredOpenAIModel,
  rememberOpenAIModel,
} from "@/lib/app/openai-models";

/**
 * The credential a browser needs to hold a spoken conversation.
 *
 * A conversation is a connection held open for its whole length and a
 * serverless function cannot hold one, so the browser opens it itself. That
 * leaves one problem: the browser needs credentials, and a real API key in a
 * browser is a key on the internet.
 *
 * Ephemeral credentials are the answer, and the important part is what goes
 * into them. Model, system instruction, tools and voice are all baked in
 * here, so a modified client cannot point the paid model at something else on
 * our bill — it can only open the conversation that was already described.
 *
 * Two providers, two protocols, one shape of answer. OpenAI Realtime speaks
 * WebRTC and Gemini Live speaks WebSocket; the caller passes the provider
 * name down to the client, which picks its transport from it.
 *
 * Deliberately not a route: the route's job is who is asking and whether they
 * are allowed, and this file's job is the credential. Keeping them apart is
 * what makes this testable without a signed-in session.
 */

const OPENAI_BASE = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";

const GEMINI_AUTH_ENDPOINT =
  (process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/models")
    .replace(/\/models$/, "") + "/auth_tokens";

/**
 * The spoken voice for OpenAI Realtime.
 *
 * Falls back to the greeting's voice, so the agent does not change voice
 * halfway through meeting somebody.
 */
const OPENAI_VOICE = process.env.OPENAI_REALTIME_VOICE ?? process.env.OPENAI_TTS_VOICE ?? "marin";

export type LiveProvider = "openai" | "gemini";

export type Ticket =
  | { ok: true; provider: LiveProvider; token: string; model: string; callsUrl?: string }
  | { ok: false; error: string; status: number };

/** Which provider will answer, or null when neither key is set. */
export function liveProvider(): LiveProvider | null {
  const forced = process.env.LIVE_PROVIDER?.trim().toLowerCase();
  if (forced === "openai") return process.env.OPENAI_API_KEY ? "openai" : null;
  if (forced === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export async function mintTicket(instruction: string): Promise<Ticket> {
  const provider = liveProvider();
  if (!provider) {
    console.error(
      "live-ticket: neither OPENAI_API_KEY nor GEMINI_API_KEY is set, so live voice cannot start.",
    );
    return { ok: false, error: "Live voice isn't switched on yet.", status: 503 };
  }
  return provider === "openai" ? openaiTicket(instruction) : geminiTicket(instruction);
}

/* ---------------------------------------------------------------- openai */

async function openaiTicket(instruction: string): Promise<Ticket> {
  const key = process.env.OPENAI_API_KEY!;

  const ask = (model: string) =>
    fetch(`${OPENAI_BASE}/realtime/client_secrets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        expires_after: {
          anchor: "created_at",
          // The window to *open* the call, not to talk in it. Two minutes is
          // plenty for a click, and it means a secret found in a log tomorrow
          // is worthless.
          seconds: 120,
        },
        session: {
          type: "realtime",
          model,
          instructions: instruction,
          // Audio out. The transcript comes down the data channel alongside
          // it, so there is no second bill and nothing to re-derive.
          output_modalities: ["audio"],
          audio: {
            input: {
              // Without this there is no record of what the person said, and
              // the on-screen transcript would have to be guessed from audio.
              transcription: { model: "gpt-4o-mini-transcribe" },
              // The server decides when a turn ended. Doing that in the
              // browser means every slow speaker gets talked over.
              turn_detection: { type: "server_vad", create_response: true },
              noise_reduction: { type: "near_field" },
            },
            output: { voice: OPENAI_VOICE, speed: 1 },
          },
          tools: toolsForOpenAI(TOOLS),
          tool_choice: "auto",
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

  let model = preferredOpenAIModel("realtime");
  let response: Response;
  try {
    response = await ask(model);

    // Same lesson as everywhere else: which models a key can reach is not
    // knowable from the documentation. On a rejection that names the model,
    // ask the account what it has. An explicit OPENAI_REALTIME_MODEL is never
    // second-guessed — a deliberate choice should fail loudly.
    if (
      !response.ok &&
      !pinnedOpenAI("realtime") &&
      (response.status === 404 || response.status === 400)
    ) {
      const body = await response.clone().text().catch(() => "");
      if (/model/i.test(body)) {
        const found = await discoverOpenAIModel(key, [model], "realtime");
        if (found && found !== model) {
          model = found;
          response = await ask(model);
        }
      }
    }
  } catch {
    return { ok: false, error: "Could not reach the voice service.", status: 502 };
  }

  if (!response.ok) {
    // OpenAI's error text can name the organisation; it is not for the browser.
    console.error(
      "live-ticket: client_secrets returned",
      response.status,
      (await response.text().catch(() => "")).slice(0, 600),
    );
    return {
      ok: false,
      error:
        response.status === 404 || response.status === 400
          ? "No live voice model is available on this API key."
          : "Could not start a voice session.",
      status: 502,
    };
  }

  const json = (await response.json().catch(() => null)) as {
    value?: string;
    secret?: string;
    client_secret?: { value?: string };
  } | null;

  // Three spellings of this field have been in the wild. Reading whichever
  // turned up costs one line and saves a launch-day outage.
  const token = json?.value ?? json?.secret ?? json?.client_secret?.value;
  if (!token) {
    console.error(
      "live-ticket: client_secrets returned no secret",
      JSON.stringify(json).slice(0, 300),
    );
    return { ok: false, error: "The voice service returned no token.", status: 502 };
  }

  rememberOpenAIModel(model, "realtime");
  return {
    ok: true,
    provider: "openai",
    token,
    model,
    callsUrl: `${OPENAI_BASE}/realtime/calls`,
  };
}

/* ---------------------------------------------------------------- gemini */

async function geminiTicket(instruction: string): Promise<Ticket> {
  const key = process.env.GEMINI_API_KEY!;
  const now = Date.now();

  const ask = (model: string) =>
    fetch(GEMINI_AUTH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        uses: 1,
        // Long enough for a conversation, short enough that a token found in
        // a log tomorrow is worthless.
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        // The window to *open* the socket, not to talk. A minute is plenty
        // for a click, and it means a leaked token is almost always dead.
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: {
          model: `models/${model}`,
          config: {
            responseModalities: ["AUDIO"],
            // The spoken answer and its text are the same turn. Without this
            // the transcript would have to be re-derived from audio, which is
            // both a second bill and a second thing to be wrong.
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            systemInstruction: { parts: [{ text: instruction }] },
            tools: TOOLS,
            temperature: 0.4,
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

  let model = preferredModel("live");
  let response: Response;
  try {
    response = await ask(model);

    if (response.status === 404 && !pinned("live")) {
      const found = await discoverModel(key, "live");
      if (found && found !== model) {
        model = found;
        response = await ask(model);
      }
    }
  } catch {
    return { ok: false, error: "Could not reach the voice service.", status: 502 };
  }

  if (!response.ok) {
    // Google's error text can carry the project id; it is not for the browser.
    console.error(
      "live-ticket: auth_tokens returned",
      response.status,
      (await response.text().catch(() => "")).slice(0, 600),
    );
    return {
      ok: false,
      error:
        response.status === 404
          ? "No live voice model is available on this API key."
          : "Could not start a voice session.",
      status: 502,
    };
  }

  const json = (await response.json().catch(() => null)) as { name?: string } | null;
  if (!json?.name) {
    return { ok: false, error: "The voice service returned no token.", status: 502 };
  }

  rememberModel("live", model);
  return { ok: true, provider: "gemini", token: json.name, model };
}
