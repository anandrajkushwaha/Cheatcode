import "server-only";
import { TOOLS } from "@/lib/app/agent-tools";
import { toolsForOpenAI } from "@/lib/app/llm";
import { discoverModel, pinned, preferredModel, rememberModel } from "@/lib/app/gemini-models";
import {
  discoverOpenAIModel,
  pinnedOpenAI,
  preferredOpenAIModel,
  rememberOpenAIModel,
  transcribeModel,
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
  | {
      ok: false;
      error: string;
      status: number;
      /**
       * The provider's own words, verbatim.
       *
       * For the diagnose route only. The live-token route deliberately does
       * not forward it — it can name the organisation, and a job seeker can
       * do nothing with it anyway. But whoever is running the app can do
       * everything with it, and having to read Vercel logs to find out why a
       * mic button does nothing is a bad afternoon.
       */
      detail?: string;
      upstreamStatus?: number;
      model?: string;
    };

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

/**
 * The session we would like, before the API has had an opinion about it.
 *
 * Built as an object rather than a string so a field the API refuses can be
 * removed and the request tried again. Every one of these is a nicety —
 * noise reduction, a speaking rate, who decides a turn ended — and none is
 * worth a mic button that does nothing. The model, the instructions and the
 * tools are not in that category, and are never dropped.
 */
function session(model: string, instruction: string): Record<string, unknown> {
  return {
    type: "realtime",
    model,
    instructions: instruction,
    // Audio out. The transcript comes down the data channel alongside it, so
    // there is no second bill and nothing to re-derive.
    output_modalities: ["audio"],
    audio: {
      input: {
        // Without this there is no record of what the person said, and the
        // on-screen transcript would have to be guessed from audio.
        transcription: { model: transcribeModel() },
        // The server decides when a turn ended. Doing that in the browser
        // means every slow speaker gets talked over.
        turn_detection: { type: "server_vad", create_response: true },
        noise_reduction: { type: "near_field" },
      },
      output: { voice: OPENAI_VOICE, speed: 1 },
    },
    // Realtime takes the same tool shape as the Responses API minus `strict`,
    // which it does not know about — and one unknown key fails the whole
    // session, not just the field.
    tools: toolsForOpenAI(TOOLS).map(({ strict: _strict, ...tool }) => tool),
    tool_choice: "auto",
  };
}

async function openaiTicket(instruction: string): Promise<Ticket> {
  const key = process.env.OPENAI_API_KEY!;

  let model = preferredOpenAIModel("realtime");
  let body = session(model, instruction);

  const ask = () =>
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
        session: body,
      }),
      signal: AbortSignal.timeout(15_000),
    });

  let response: Response;
  let lastBody = "";
  let discovered = false;
  let dropped = 0;

  try {
    /**
     * Up to four goes, and each one has to be earned by a specific complaint.
     *
     * The first version treated every 400 as "wrong model", which was both
     * wrong and actively misleading: a rejected parameter — a turn-detection
     * field the API has since renamed, say — came out as "no live voice model
     * is available on this API key", and sent the debugging in exactly the
     * wrong direction. A refusal that names a parameter is now answered by
     * removing that parameter, and only a refusal that names the model sends
     * us looking for a different one.
     */
    for (let attempt = 0; ; attempt++) {
      response = await ask();
      if (response.ok) break;

      lastBody = await response.text().catch(() => "");
      if (attempt >= 4) break;

      const offending = unknownParameter(lastBody);
      if (offending && dropped < 4 && remove(body, offending)) {
        console.warn(`live-ticket: ${offending} was refused; retrying without it`);
        dropped++;
        continue;
      }

      if (
        !discovered &&
        !pinnedOpenAI("realtime") &&
        (response.status === 404 || response.status === 400) &&
        /\bmodel\b/i.test(lastBody)
      ) {
        discovered = true;
        const found = await discoverOpenAIModel(key, [model], "realtime");
        if (found && found !== model) {
          model = found;
          body = session(model, instruction);
          dropped = 0;
          continue;
        }
      }

      break;
    }
  } catch {
    return { ok: false, error: "Could not reach the voice service.", status: 502 };
  }

  if (!response.ok) {
    // OpenAI's error text can name the organisation; it is not for the browser.
    console.error("live-ticket: client_secrets returned", response.status, lastBody.slice(0, 800));
    return {
      ok: false,
      error:
        response.status === 401 || response.status === 403
          ? "Voice isn't switched on properly on this key."
          : response.status === 429
            ? "Voice is rate limited right now. Try again in a moment."
            : "Voice couldn't start. The server log has the reason.",
      status: 502,
      detail: messageOf(lastBody),
      upstreamStatus: response.status,
      model,
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

/** The provider's message, unwrapped from its envelope where there is one. */
function messageOf(body: string): string {
  try {
    const j = JSON.parse(body) as { error?: { message?: string; type?: string; code?: string } };
    return `${j.error?.type ?? j.error?.code ?? ""} ${j.error?.message ?? ""}`.trim().slice(0, 600);
  } catch {
    return body.slice(0, 600);
  }
}

/**
 * Which field the API is complaining about, if it named one.
 *
 * Both spellings are in the wild depending on which validator rejects the
 * request first, and both give a dotted path from the request root.
 */
function unknownParameter(body: string): string | null {
  const m =
    body.match(/Unknown parameter: '([^']+)'/i) ??
    body.match(/Unrecognized request argument supplied: ([A-Za-z0-9_.[\]]+)/i) ??
    body.match(/Invalid type for '([^']+)'/i) ??
    body.match(/Missing required parameter: '([^']+)'/i);
  const path = m?.[1] ?? null;
  if (!path) return null;

  // Only the session's own model is off limits — deleting it would send a
  // request with no model at all and fail differently. Any *other* path that
  // happens to end in "model" is an ordinary field: the transcription model
  // nested three levels down is the one that caught this out.
  return path.replace(/^session\./, "") === "model" ? null : path;
}

/**
 * Delete a dotted path from the session object. Returns whether it found one.
 *
 * Paths arrive rooted at the request (`session.audio.input.noise_reduction`),
 * so the leading segment is stripped. Refusing to delete a top-level
 * requirement is deliberate: without instructions or tools this is a
 * different product, and failing loudly is better than answering as one.
 */
function remove(sessionBody: Record<string, unknown>, path: string): boolean {
  // "tools[0].strict" is one step into an array and one into an object. Left
  // unsplit it matched nothing, the adaptation gave up, and a fixable refusal
  // became a dead call.
  const parts = path
    .replace(/^session\./, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  if (parts.length === 1 && ["model", "type", "instructions", "tools"].includes(parts[0])) {
    return false;
  }

  let node: Record<string, unknown> = sessionBody;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = node[parts[i]];
    if (!next || typeof next !== "object") return false;
    node = next as Record<string, unknown>;
  }

  const last = parts[parts.length - 1];
  if (!(last in node)) return false;
  delete node[last];

  // Removing the only field of an object leaves an empty one behind, and an
  // empty `transcription: {}` is a different request from no transcription at
  // all — one that a validator is entitled to reject on its own.
  prune(sessionBody, parts.slice(0, -1));
  return true;
}

/** Walk back up the path, dropping any object we have just emptied. */
function prune(root: Record<string, unknown>, parts: string[]): void {
  for (let depth = parts.length; depth > 0; depth--) {
    let node: Record<string, unknown> = root;
    for (let i = 0; i < depth - 1; i++) {
      node = node[parts[i]] as Record<string, unknown>;
      if (!node || typeof node !== "object") return;
    }
    const key = parts[depth - 1];
    const child = node[key];
    // Never prune out of an array: deleting an element leaves a hole, which
    // serialises as null and is a worse request than an empty object.
    if (Array.isArray(node)) return;
    if (child && typeof child === "object" && Object.keys(child).length === 0) delete node[key];
    else return;
  }
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
    const geminiBody = await response.text().catch(() => "");
    console.error("live-ticket: auth_tokens returned", response.status, geminiBody.slice(0, 600));
    return {
      ok: false,
      error:
        response.status === 404
          ? "No live voice model is available on this API key."
          : "Could not start a voice session.",
      status: 502,
      detail: messageOf(geminiBody),
      upstreamStatus: response.status,
      model,
    };
  }

  const json = (await response.json().catch(() => null)) as { name?: string } | null;
  if (!json?.name) {
    return { ok: false, error: "The voice service returned no token.", status: 502 };
  }

  rememberModel("live", model);
  return { ok: true, provider: "gemini", token: json.name, model };
}
