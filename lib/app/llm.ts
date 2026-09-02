import "server-only";
import {
  discoverModel as discoverGemini,
  pinned as pinnedGemini,
  preferredModel as preferredGemini,
  rememberModel as rememberGemini,
} from "@/lib/app/gemini-models";
import {
  discoverOpenAIModel,
  pinnedOpenAI,
  preferredOpenAIModel,
  rememberOpenAIModel,
} from "@/lib/app/openai-models";

/**
 * One model, two providers, everything else identical.
 *
 * The typed agent, resume parsing and intent reading all do the same two
 * things: hold a short conversation with tools attached, or ask for one
 * structured JSON answer. Those were written three times against Gemini, with
 * three separate copies of the retry logic and three slightly different sets
 * of error messages, and when the key changed to OpenAI all three had to
 * change. They live here now.
 *
 * OpenAI is used when OPENAI_API_KEY is set, Gemini otherwise, and
 * LLM_PROVIDER overrides both when you want to be explicit. The live voice
 * agent is deliberately not routed through here — the Live API is a
 * WebSocket protocol that only Gemini speaks, and pretending otherwise would
 * be a lie in a type signature.
 *
 * What is shared is the part that took the longest to get right: three
 * attempts with backoff and jitter, discovery on a 404 rather than a dead
 * end, one swap to a different model when the first is overloaded, the
 * upstream error body in the server log every single time, and a sentence
 * for the person that they can actually act on.
 */

export type Provider = "openai" | "gemini" | "sarvam";

import { readUsage, type Feature, type UsageMeta } from "@/lib/app/ai-cost";
import { recordUsage } from "@/lib/app/ai-usage";

import {
  discoverSarvamModel,
  pinnedSarvam,
  preferredSarvamModel,
  sarvamChatUrl,
  sarvamHeaders,
} from "@/lib/app/sarvam-models";

const OPENAI_BASE = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";
const GEMINI_BASE =
  process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Busy, not broken.
 *
 * These are common enough on both providers to be the normal case rather than
 * the exception, and the first version of this treated them as fatal and
 * showed the status code to the person — useless to them, and giving up on a
 * request that would almost certainly have worked a second later.
 */
const RETRY_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);
const ATTEMPTS = 3;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------- provider */

const PROVIDERS: Provider[] = ["openai", "gemini", "sarvam"];

const isProvider = (v: string | undefined): v is Provider =>
  Boolean(v && (PROVIDERS as string[]).includes(v));

/**
 * Who answers, and it can differ per feature.
 *
 * The per-feature override is what makes moving providers survivable. Pulling
 * an entire product onto a new model in one switch means finding out about
 * every regression at once, in production, from users. Instead the cheapest,
 * highest-volume and most mechanical call — reading an uploaded resume into
 * structured fields — can move on its own and be judged on its own, while the
 * conversation stays where it is.
 *
 *   LLM_PROVIDER=openai
 *   LLM_PROVIDER_RESUME_EXTRACTION=sarvam
 *
 * The feature names are the ones in ai-cost.ts, uppercased, which is also what
 * the spend rows are grouped by — so the thing you measure and the thing you
 * switch are named the same.
 */
export function provider(feature?: Feature): Provider | null {
  if (feature) {
    const perFeature = process.env[`LLM_PROVIDER_${feature.toUpperCase()}`]?.trim().toLowerCase();
    if (isProvider(perFeature)) return apiKey(perFeature) ? perFeature : null;
  }

  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (isProvider(forced)) return apiKey(forced) ? forced : null;

  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (process.env.SARVAM_API_KEY?.trim()) return "sarvam";
  return null;
}

function apiKey(p: Provider): string | null {
  const key =
    p === "openai"
      ? process.env.OPENAI_API_KEY
      : p === "gemini"
        ? process.env.GEMINI_API_KEY
        : process.env.SARVAM_API_KEY;
  return key?.trim() || null;
}

/** Whether there is any model to talk to at all. */
export function llmConfigured(): boolean {
  return provider() !== null;
}

/* ---------------------------------------------------------------- types */

export type Turn = { role: "user" | "model"; text: string };
export type ToolCall = { name: string; args: Record<string, unknown> };

export type LlmFail = { ok: false; error: string; status: number };
export type ChatOk = {
  ok: true;
  text: string;
  calls: ToolCall[];
  provider: Provider;
  model: string;
};
export type JsonOk = { ok: true; data: unknown; provider: Provider; model: string };

/**
 * A tool, written once in Gemini's shape.
 *
 * agent-brain.ts declares the agent's tools in Gemini's `functionDeclarations`
 * form because the live voice session sends that exact object over the socket
 * and cannot be changed. Rather than keep a second copy in OpenAI's shape —
 * two declarations of one tool, drifting apart the first time somebody adds a
 * parameter — the Gemini form stays canonical and is converted below.
 */
export type ToolBlock = {
  functionDeclarations?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }[];
};

/* ----------------------------------------------------------------- chat */

export type ChatInput = {
  system: string;
  turns: Turn[];
  tools?: ToolBlock[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /**
   * Who this call is for and what it is for.
   *
   * Required rather than optional, deliberately. Every model call in this
   * product costs money, and an optional field here would mean the one call
   * site somebody forgets is the one that never shows up in the bill. Making
   * it required moves that from a discipline problem to a compile error.
   */
  meta: UsageMeta;
};

export async function llmChat(input: ChatInput): Promise<ChatOk | LlmFail> {
  const ready = prepare(input);
  if (!ready.ok) return ready.fail;
  const { p, key, turns } = ready;

  const result = await send({
    provider: p,
    key,
    pin: pin(p),
    timeoutMs: input.timeoutMs ?? 25_000,
    build: chatBody(p, input, turns, false),
  });

  if (!result.ok) return failure(result, p);

  const json = await result.res.json().catch(() => null);
  bill(input.meta, p, result.model, json);

  const read = readFor(p, json);
  if (!read.text && !read.calls.length) {
    console.error(
      `llm: ${p}/${result.model} returned nothing usable`,
      JSON.stringify(json).slice(0, 600),
    );
    return { ok: false, error: "The model returned nothing.", status: 502 };
  }

  return { ok: true, ...read, provider: p, model: result.model };
}

/**
 * The same answer, but arriving as it is written.
 *
 * Latency here is not really latency, it is silence: a good answer that takes
 * four seconds feels broken and the same answer that starts in one feels
 * quick, because the wait is spent reading rather than watching a dot. The
 * total is barely different; the experience is not comparable.
 *
 * Tool calls are read from the final event rather than from the delta stream.
 * The event names for streamed function arguments have changed spelling more
 * than once, and the completed response object has not — a job card that
 * silently stops appearing is a worse failure than a slightly later one.
 *
 * `onDelta` is called with each new fragment, never the accumulated text, so
 * a caller can append rather than re-render everything.
 */
export async function llmChatStream(
  input: ChatInput,
  onDelta: (chunk: string) => void,
): Promise<ChatOk | LlmFail> {
  const ready = prepare(input);
  if (!ready.ok) return ready.fail;
  const { p, key, turns } = ready;

  const result = await send({
    provider: p,
    key,
    pin: pin(p),
    timeoutMs: input.timeoutMs ?? 25_000,
    build: chatBody(p, input, turns, true),
  });

  if (!result.ok) return failure(result, p);

  let text = "";
  let calls: ToolCall[] = [];
  let upstreamError: string | null = null;
  let lastGeminiChunk: unknown = null;
  /** The usage-bearing final chunk of a chat-completions stream. */
  let lastChatChunk: unknown = null;
  /** Tool calls assembled across chunks, by index. */
  const sarvamCalls: Record<number, { name: string; args: string }> = {};

  try {
    for await (const frame of sse(result.res)) {
      if (frame === "[DONE]") break;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(frame) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (p === "sarvam") {
        /**
         * Chat-completions streaming: text arrives in `choices[0].delta`, and
         * the usage block arrives on its own final chunk with an empty
         * `choices` array. Tool call fragments also stream, but assembling
         * partial JSON argument strings is the part every hand-written client
         * gets wrong — so they are collected whole below, from the chunk that
         * carries a finish_reason.
         */
        const chunk = event as {
          choices?: {
            delta?: {
              content?: string | null;
              tool_calls?: {
                index?: number;
                function?: { name?: string; arguments?: string };
              }[];
            };
            finish_reason?: string | null;
          }[];
          usage?: unknown;
        };

        const choice = chunk.choices?.[0];
        const piece = choice?.delta?.content;
        if (typeof piece === "string" && piece) {
          text += piece;
          onDelta(piece);
        }

        for (const call of choice?.delta?.tool_calls ?? []) {
          const at = call.index ?? 0;
          const slot = (sarvamCalls[at] ??= { name: "", args: "" });
          if (call.function?.name) slot.name = call.function.name;
          if (call.function?.arguments) slot.args += call.function.arguments;
        }

        if (chunk.usage) lastChatChunk = chunk;
      } else if (p === "openai") {
        const type = event.type as string | undefined;
        if (type === "response.output_text.delta") {
          const delta = event.delta;
          if (typeof delta === "string" && delta) {
            text += delta;
            onDelta(delta);
          }
        } else if (type === "response.completed" || type === "response.incomplete") {
          // The usage block rides on the completed event and nowhere else, so
          // a stream that breaks early is a call we cannot cost. That is
          // recorded honestly as a missing row rather than an invented one.
          bill(input.meta, p, result.model, event.response);

          const read = readOpenAI(event.response);
          calls = read.calls;
          // The assembled response is the authority. Deltas can be missed at
          // the edges of a chunk boundary; this cannot.
          if (read.text) text = read.text;
        } else if (type === "error" || type === "response.failed") {
          upstreamError = JSON.stringify(event).slice(0, 300);
        }
      } else {
        // Gemini streams whole GenerateContentResponse chunks, so the same
        // reader works — it just has to be told to append rather than replace.
        const read = readGemini(event);
        if (read.text) {
          text += read.text;
          onDelta(read.text);
        }
        if (read.calls.length) calls = calls.concat(read.calls);
        // Gemini repeats usageMetadata on every chunk with running totals, so
        // the last one seen is the whole call. Held and written once at the
        // end rather than a row per chunk.
        if (event.usageMetadata) lastGeminiChunk = event;
      }
    }
  } catch (e) {
    // The stream broke partway. Whatever arrived is still a real answer, and
    // showing it beats replacing it with an apology.
    console.error(`llm: ${p}/${result.model} stream broke —`, String(e).slice(0, 200));
    if (!text) return { ok: false, error: "The answer was cut off. Ask again.", status: 502 };
  }

  // Arguments stream in fragments and are only valid JSON once complete, so
  // they are parsed here rather than per chunk.
  for (const slot of Object.values(sarvamCalls)) {
    if (!slot.name) continue;
    try {
      calls.push({ name: slot.name, args: JSON.parse(slot.args || "{}") as Record<string, unknown> });
    } catch {
      console.warn(`llm: unparseable streamed arguments for ${slot.name}`);
    }
  }

  if (lastGeminiChunk) bill(input.meta, p, result.model, lastGeminiChunk);
  if (lastChatChunk) bill(input.meta, p, result.model, lastChatChunk);

  if (upstreamError) console.error(`llm: ${p}/${result.model} streamed an error`, upstreamError);

  if (!text && !calls.length) {
    console.error(`llm: ${p}/${result.model} streamed nothing usable`, upstreamError ?? "");
    return { ok: false, error: "The model returned nothing.", status: 502 };
  }

  return { ok: true, text, calls, provider: p, model: result.model };
}

/* ------------------------------------------------------- shared plumbing */

/**
 * Record what that call cost.
 *
 * One function so there is one place to look, and so the four public entry
 * points cannot each grow their own slightly different version. It reads the
 * usage block off whatever the provider returned and hands it on; if there is
 * no usage block, nothing is written — a row with every column null would be
 * an accounting entry that says nothing.
 */
function bill(meta: UsageMeta, p: Provider, model: string, json: unknown): void {
  const usage = readUsage(json);
  if (usage.input === undefined && usage.output === undefined) return;
  recordUsage({ ...meta, provider: p, model, usage });
}


type Ready =
  | { ok: true; p: Provider; key: string; turns: Turn[] }
  | { ok: false; fail: LlmFail };

/** The two refusals both chat paths share, decided once. */
function prepare(input: ChatInput): Ready {
  const p = provider(input.meta.feature);
  const key = p && apiKey(p);
  if (!p || !key) {
    return { ok: false, fail: { ok: false, error: "The agent isn't switched on yet.", status: 503 } };
  }
  const turns = input.turns.filter((t) => t.text.trim());
  if (!turns.length) {
    return { ok: false, fail: { ok: false, error: "Nothing to answer.", status: 400 } };
  }
  return { ok: true, p, key, turns };
}

/**
 * One request body for both paths.
 *
 * Streaming used to be a second copy of this, and a second copy is how the
 * streamed agent quietly ends up with different tools or a different
 * temperature from the typed one.
 */
function chatBody(p: Provider, input: ChatInput, turns: Turn[], stream: boolean) {
  const temperature = input.temperature ?? 0.4;
  const maxTokens = input.maxTokens ?? 400;
  const key = apiKey(p)!;

  return (model: string, drop: Set<Drop>): Built => {
    if (p === "sarvam") {
      return {
        url: sarvamChatUrl(model),
        headers: sarvamHeaders(key),
        body: JSON.stringify({
          model,
          messages: chatMessages(input.system, turns),
          ...(input.tools && !drop.has("tools") ? { tools: toolsForChat(input.tools) } : {}),
          ...(drop.has("temperature") ? {} : { temperature }),
          ...(drop.has("maxTokens") ? {} : { max_tokens: maxTokens }),
          ...(stream ? { stream: true } : {}),
        }),
      };
    }

    return p === "openai"
      ? {
          url: `${OPENAI_BASE}/responses`,
          headers: openaiHeaders(key),
          body: JSON.stringify({
            model,
            instructions: input.system,
            input: turns.map((t) => ({
              role: t.role === "model" ? "assistant" : "user",
              content: t.text,
            })),
            ...(input.tools && !drop.has("tools") ? { tools: toolsForOpenAI(input.tools) } : {}),
            ...(drop.has("temperature") ? {} : { temperature }),
            // A reasoning model thinks before it says anything, and on a
            // two-sentence answer to "any React jobs in Pune" that thinking is
            // most of the wait. Low rather than minimal: minimal is not on
            // every model, and being refused would drop the field entirely and
            // land back on the slow default.
            ...(drop.has("reasoning") ? {} : { reasoning: { effort: "low" } }),
            // Reasoning models spend output tokens thinking before they say
            // anything, so a 400-token cap can be consumed entirely by
            // reasoning and return an empty answer. The floor is headroom, not
            // a budget — billing follows what is actually used, and the
            // instructions already ask for two or three sentences.
            ...(drop.has("maxTokens") ? {} : { max_output_tokens: Math.max(maxTokens, 1500) }),
            store: process.env.OPENAI_STORE === "1",
            ...(stream ? { stream: true } : {}),
          }),
        }
      : {
          url: `${GEMINI_BASE}/${model}:${
            stream ? "streamGenerateContent?alt=sse" : "generateContent"
          }`,
          headers: geminiHeaders(key),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: input.system }] },
            contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
            ...(input.tools && !drop.has("tools") ? { tools: input.tools } : {}),
            generationConfig: {
              ...(drop.has("temperature") ? {} : { temperature }),
              ...(drop.has("maxTokens") ? {} : { maxOutputTokens: maxTokens }),
            },
          }),
        };
  };
}

/**
 * Server-sent events, one payload at a time.
 *
 * Both providers stream in this format. Frames are separated by a blank line
 * and a frame can carry comments and other fields we do not want, so only
 * `data:` lines are yielded — and a frame can be split across two network
 * chunks, which is the bug every hand-written SSE reader has at least once.
 */
async function* sse(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let split: number;
      while ((split = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        for (const line of frame.split("\n")) {
          if (line.startsWith("data:")) yield line.slice(5).trim();
        }
      }
    }
  } finally {
    // A stream abandoned without cancelling holds the connection open until
    // it times out, which on a serverless function is billed time.
    await reader.cancel().catch(() => {});
  }
}

/* -------------------------------------------------------------- reading */

/**
 * What a picture says.
 *
 * Only ever reached for a scan or a photo — something with no text layer to
 * extract. A separate function rather than an option on llmChat because the
 * shape of the request is genuinely different (content becomes an array of
 * parts) and because this one should never carry tools, history or a
 * personality: it is a transcription, and a model that starts being helpful
 * about a resume it was asked to type out is a bug.
 *
 * Images arrive as data URLs, which is how both providers want them and how
 * the browser already has them.
 */
export async function llmVision(input: {
  system: string;
  text: string;
  images: string[];
  maxTokens?: number;
  timeoutMs?: number;
  meta: UsageMeta;
}): Promise<ChatOk | LlmFail> {
  const p = provider(input.meta.feature);
  const key = p && apiKey(p);
  if (!p || !key) return { ok: false, error: "Reading isn't switched on yet.", status: 503 };
  if (!input.images.length) return { ok: false, error: "Nothing to read.", status: 400 };

  /**
   * Sarvam's own models are text only, so a scan goes to an open-weight one.
   *
   * `sarvam-105b` cannot see. The /v2 endpoint serves models that can, and
   * Gemma is the one documented as accepting base64 images. Those models are
   * explicitly not tuned for Indian languages, which would matter enormously
   * for a conversation and matters much less here: this call transcribes a
   * page, it does not talk to anybody.
   *
   * Sarvam also sell a purpose-built document-understanding product. That is
   * the better long-term home for this, and a different API shape, so it is a
   * later job rather than a blocker today.
   */
  const visionModel =
    p === "sarvam" ? process.env.SARVAM_VISION_MODEL?.trim() || "gemma-4-31b" : null;

  const maxTokens = input.maxTokens ?? 4000;

  const result = await send({
    provider: p,
    key,
    // Sarvam's flagship cannot see, so a scan is the one call that does not use
    // the configured chat model.
    pin: visionModel ?? pin(p),
    timeoutMs: input.timeoutMs ?? 90_000,
    build: (model, drop) => {
      if (p === "sarvam") {
        return {
          url: sarvamChatUrl(model),
          headers: sarvamHeaders(key),
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: input.system },
              {
                role: "user",
                content: [
                  { type: "text", text: input.text },
                  // Base64 data URLs, which is what the model accepts and what
                  // the browser already produced when it shrank the pages.
                  ...input.images.map((url) => ({ type: "image_url", image_url: { url } })),
                ],
              },
            ],
            ...(drop.has("maxTokens") ? {} : { max_tokens: maxTokens }),
          }),
        };
      }

      return p === "openai"
        ? {
            url: `${OPENAI_BASE}/responses`,
            headers: openaiHeaders(key),
            body: JSON.stringify({
              model,
              instructions: input.system,
              input: [
                {
                  role: "user",
                  content: [
                    { type: "input_text", text: input.text },
                    ...input.images.map((image_url) => ({ type: "input_image", image_url })),
                  ],
                },
              ],
              // Transcription, not deliberation. Whatever thinking budget the
              // model has is better spent on the characters.
              ...(drop.has("reasoning") ? {} : { reasoning: { effort: "low" } }),
              ...(drop.has("maxTokens") ? {} : { max_output_tokens: Math.max(maxTokens, 2000) }),
              store: process.env.OPENAI_STORE === "1",
            }),
          }
        : {
            url: `${GEMINI_BASE}/${model}:generateContent`,
            headers: geminiHeaders(key),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: input.system }] },
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: input.text },
                    ...input.images.map((url) => {
                      const [head, data] = url.split(",", 2);
                      const mimeType = head.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
                      return { inlineData: { mimeType, data: data ?? "" } };
                    }),
                  ],
                },
              ],
              generationConfig: {
                ...(drop.has("temperature") ? {} : { temperature: 0 }),
                ...(drop.has("maxTokens") ? {} : { maxOutputTokens: maxTokens }),
              },
            }),
          };
    },
  });

  if (!result.ok) return failure(result, p);

  const json = await result.res.json().catch(() => null);
  bill(input.meta, p, result.model, json);

  const read = readFor(p, json);
  if (!read.text) {
    console.error(`llm: ${p}/${result.model} read nothing from ${input.images.length} image(s)`);
    return { ok: false, error: "Nothing readable came off that.", status: 502 };
  }

  return { ok: true, text: read.text, calls: [], provider: p, model: result.model };
}

/* -------------------------------------------------------- structured JSON */

export async function llmJson(input: {
  system: string;
  user: string;
  /** Gemini-shaped schema. Converted to JSON Schema for OpenAI. */
  schema: Record<string, unknown>;
  /** A name for the schema; OpenAI requires one. Lowercase, no spaces. */
  name: string;
  /** An explicit model, if this call site has its own override. */
  pin?: string | null;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  meta: UsageMeta;
}): Promise<JsonOk | LlmFail> {
  const p = provider(input.meta.feature);
  const key = p && apiKey(p);
  if (!p || !key) return { ok: false, error: "The model isn't switched on yet.", status: 503 };

  const temperature = input.temperature ?? 0;
  const jsonSchema = toJsonSchema(input.schema);

  const result = await send({
    provider: p,
    key,
    // A per-call override wins; otherwise the provider-wide one.
    pin: input.pin?.trim() || pin(p),
    timeoutMs: input.timeoutMs ?? 45_000,
    build: (model, drop) => {
      if (p === "sarvam") {
        return {
          url: sarvamChatUrl(model),
          headers: sarvamHeaders(key),
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                // Same fallback as the other two: if the strict schema format
                // is refused, the shape has to be described in words instead.
                content: drop.has("schema")
                  ? `${input.system}\n\nReply with a single JSON object and nothing else. It must match this JSON Schema exactly:\n${JSON.stringify(jsonSchema)}`
                  : input.system,
              },
              { role: "user", content: input.user },
            ],
            response_format: drop.has("schema")
              ? { type: "json_object" }
              : {
                  type: "json_schema",
                  json_schema: {
                    name: input.name,
                    strict: true,
                    schema: jsonSchema,
                  },
                },
            ...(drop.has("temperature") ? {} : { temperature }),
            ...(drop.has("maxTokens") ? {} : { max_tokens: input.maxTokens ?? 4000 }),
          }),
        };
      }

      return p === "openai"
        ? {
            url: `${OPENAI_BASE}/responses`,
            headers: openaiHeaders(key),
            body: JSON.stringify({
              model,
              // When the schema format is refused we fall back to plain JSON
              // mode, and then the shape has to be described in words instead.
              instructions: drop.has("schema")
                ? `${input.system}\n\nReply with a single JSON object and nothing else. It must match this JSON Schema exactly:\n${JSON.stringify(jsonSchema)}`
                : input.system,
              input: [{ role: "user", content: input.user }],
              text: {
                format: drop.has("schema")
                  ? { type: "json_object" }
                  : {
                      type: "json_schema",
                      name: input.name,
                      // Not strict: strict mode requires every property to be
                      // required and additionalProperties false throughout,
                      // and these schemas are deliberately full of optional
                      // fields because "absent" is a meaningful answer.
                      strict: false,
                      schema: jsonSchema,
                    },
              },
              ...(drop.has("temperature") ? {} : { temperature }),
              // Same floor as chat, for the same reason: a reasoning model
              // spends output tokens thinking, and a cap sized for the answer
              // alone comes back empty rather than short.
              ...(drop.has("maxTokens")
                ? {}
                : { max_output_tokens: Math.max(input.maxTokens ?? 8000, 2000) }),
              store: process.env.OPENAI_STORE === "1",
            }),
          }
        : {
            url: `${GEMINI_BASE}/${model}:generateContent`,
            headers: geminiHeaders(key),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: input.system }] },
              contents: [{ role: "user", parts: [{ text: input.user }] }],
              generationConfig: {
                responseMimeType: "application/json",
                ...(drop.has("schema") ? {} : { responseSchema: input.schema }),
                ...(drop.has("temperature") ? {} : { temperature }),
                ...(input.maxTokens && !drop.has("maxTokens")
                  ? { maxOutputTokens: input.maxTokens }
                  : {}),
              },
            }),
          };
    },
  });

  if (!result.ok) return failure(result, p);

  const json = await result.res.json().catch(() => null);
  bill(input.meta, p, result.model, json);

  const read = readFor(p, json);
  const raw = read.text.trim();
  if (!raw) {
    console.error(
      `llm: ${p}/${result.model} returned no JSON`,
      JSON.stringify(json).slice(0, 600),
    );
    return { ok: false, error: "The model returned nothing usable.", status: 502 };
  }

  try {
    return { ok: true, data: JSON.parse(strip(raw)), provider: p, model: result.model };
  } catch {
    console.error(`llm: ${p}/${result.model} returned invalid JSON`, raw.slice(0, 400));
    return { ok: false, error: "The model's answer wasn't valid JSON.", status: 502 };
  }
}

/**
 * Models asked for JSON in plain mode sometimes wrap it in a code fence.
 * Cheap to undo, and the alternative is a parse error on a good answer.
 */
function strip(raw: string): string {
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : raw;
}

/* ------------------------------------------------------------- transport */

/** Fields we can remove from a request when the provider rejects it. */
type Drop = "temperature" | "maxTokens" | "schema" | "tools" | "reasoning";

type Built = { url: string; headers: Record<string, string>; body: string };

type SendOk = { ok: true; res: Response; model: string };
type SendFail = {
  ok: false;
  status: number;
  body: string;
  model: string;
  reason?: "timeout" | "unreachable";
};

async function send(o: {
  provider: Provider;
  key: string;
  pin: string | null;
  timeoutMs: number;
  build: (model: string, drop: Set<Drop>) => Built;
}): Promise<SendOk | SendFail> {
  let model = o.pin ?? preferred(o.provider);
  const tried: string[] = [];
  const drop = new Set<Drop>();

  let discovered = false;
  /** One switch to a different model after load, not an endless walk. */
  let swapped = false;
  let adaptations = 0;

  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await wait(400 * 2 ** (attempt - 1) + Math.random() * 250);

    const { url, headers, body } = o.build(model, drop);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(o.timeoutMs),
      });
    } catch (e) {
      // A timeout is worth one more go; anything else is the network, and
      // retrying a dead network only makes them wait longer to hear about it.
      const timedOut = e instanceof Error && e.name === "TimeoutError";
      if (timedOut && attempt < ATTEMPTS - 1) continue;
      return {
        ok: false,
        status: 0,
        body: String(e).slice(0, 300),
        model,
        reason: timedOut ? "timeout" : "unreachable",
      };
    }

    if (res.ok) {
      remember(o.provider, model);
      // The Response itself, unread. A streaming caller needs the body as it
      // arrives, and parsing it here would be the one thing that makes
      // streaming impossible.
      return { ok: true, res, model };
    }

    lastStatus = res.status;
    lastBody = await res.text().catch(() => "");

    /**
     * Three things a rejection can mean, tried in order of how sure we are.
     *
     * The order is the whole point and it was wrong once: a model that will
     * not take a temperature says so with "not supported with this model",
     * which contains the word "model", so the vaguer test below caught it
     * first and burned a round trip on discovery that could not help. The
     * specific reading goes first now, and the word "model" is only read as
     * "wrong model" once nothing more precise fits.
     */

    // Not one of the three attempts, in any of these branches. The attempts
    // exist to ride out load; finding out we asked the wrong thing is a
    // different problem, and spending a retry on it left only two for the
    // thing that actually needed them.

    // 1. A 404 is unambiguous: this key cannot reach that model. Ask what it
    //    can reach, once. Not done when the model was chosen by hand — an
    //    explicit choice that is wrong should say so, not be quietly replaced.
    if (!o.pin && !discovered && res.status === 404) {
      discovered = true;
      tried.push(model);
      const found = await discover(o.provider, o.key, tried);
      if (found && found !== model) {
        model = found;
        attempt--;
        continue;
      }
    }

    // 2. The request shape was refused by name. Providers differ on which
    //    knobs a given model accepts — some reasoning models reject
    //    `temperature` outright — and dropping the offending field beats
    //    failing in front of somebody mid-conversation. Each field is dropped
    //    at most once, so this cannot spin.
    if (res.status === 400 && adaptations < 3) {
      const what = adaptation(lastBody);
      if (what && !drop.has(what)) {
        console.warn(
          `llm: ${o.provider}/${model} refused ${what}; retrying without it —`,
          lastBody.slice(0, 300),
        );
        drop.add(what);
        adaptations++;
        attempt--;
        continue;
      }
    }

    // 3. A 400 that mentions the model and nothing we recognise. Some
    //    deployments answer an unknown model with 400 rather than 404.
    if (!o.pin && !discovered && res.status === 400 && /model/i.test(lastBody)) {
      discovered = true;
      tried.push(model);
      const found = await discover(o.provider, o.key, tried);
      if (found && found !== model) {
        model = found;
        attempt--;
        continue;
      }
    }

    if (!RETRY_STATUSES.has(res.status)) break;

    // Overload is per model, not per key. Having spent our retries being told
    // this one is busy, ask for a different one rather than reporting failure
    // — neither provider is often out of capacity on everything at once.
    if (attempt === ATTEMPTS - 1 && !swapped && !o.pin && res.status >= 500) {
      swapped = true;
      if (!tried.includes(model)) tried.push(model);
      const other = await discover(o.provider, o.key, tried);
      if (other) {
        console.info(`llm: ${model} is overloaded, trying ${other}`);
        model = other;
        attempt = -1; // a fresh set of attempts for a model we have not tried
      }
    }
  }

  return { ok: false, status: lastStatus, body: lastBody, model };
}

/**
 * Which field the provider is complaining about.
 *
 * Order matters: a message about an unsupported temperature also contains the
 * word "parameter", and a schema complaint often names the model.
 */
function adaptation(body: string): Drop | null {
  const b = body.toLowerCase();
  if (/\breasoning\b/.test(b)) return "reasoning";
  if (/temperature/.test(b)) return "temperature";
  if (/max_output_tokens|maxoutputtokens|max_tokens/.test(b)) return "maxTokens";
  if (/json_schema|response_?schema|text\.format|response_format|\bschema\b/.test(b)) {
    return "schema";
  }
  if (/\btools?\b|function_?declarations|function call/.test(b)) return "tools";
  return null;
}

/* -------------------------------------------------------------- failures */

/**
 * Say what happened in words.
 *
 * A status code in the middle of a conversation tells the person nothing they
 * can act on. The real message goes in the server log, every time — for two
 * rounds it was thrown away and the debugging was guesswork.
 */
function failure(f: SendFail, p: Provider): LlmFail {
  if (f.reason === "timeout") {
    return { ok: false, error: "That took too long. Ask again.", status: 504 };
  }
  if (f.reason === "unreachable") {
    console.error(`llm: could not reach ${p}`, f.body);
    return { ok: false, error: "Could not reach the model.", status: 502 };
  }

  console.error(`llm: ${p}/${f.model} returned ${f.status}`, f.body.slice(0, 600));

  if (f.status >= 500) {
    return { ok: false, error: "The model is busy right now. Try that again.", status: 503 };
  }
  if (f.status === 429) {
    // Two different things wear the same number. Quota is ours to fix and
    // rate limiting fixes itself, and telling somebody to wait when the
    // account is out of credit leaves them waiting forever.
    const outOfCredit = /quota|billing|credit|insufficient/i.test(f.body);
    return outOfCredit
      ? { ok: false, error: "The agent has run out of credit for now.", status: 429 }
      : { ok: false, error: "Too many requests in a row. Give it a few seconds.", status: 429 };
  }
  if (f.status === 401 || f.status === 403) {
    console.error(
      `llm: ${p} rejected the key —`,
      // Naming the wrong variable here sends somebody to check a key that was
      // never the problem, which is worse than saying nothing.
      p === "openai"
        ? "check OPENAI_API_KEY"
        : p === "sarvam"
          ? "check SARVAM_API_KEY"
          : "check GEMINI_API_KEY",
    );
    return { ok: false, error: "The agent isn't switched on properly yet.", status: 503 };
  }
  if (f.status === 404) {
    const pinnedName = pin(p);
    console.error(
      `llm: no ${p} model this key can reach`,
      pinnedName ? `(pinned to "${pinnedName}")` : "(discovery found nothing usable)",
    );
    return {
      ok: false,
      error: pinnedName
        ? `The pinned model "${pinnedName}" isn't available on this API key.`
        : "No usable model on this API key.",
      status: 502,
    };
  }
  if (f.status === 400) {
    return { ok: false, error: "That request wasn't accepted. Try rewording it.", status: 400 };
  }
  return { ok: false, error: "The agent couldn't answer that. Try again.", status: 502 };
}

/* ------------------------------------------------------- reading answers */

function readGemini(json: unknown): { text: string; calls: ToolCall[] } {
  const j = (json ?? {}) as {
    candidates?: {
      content?: {
        parts?: {
          text?: string;
          functionCall?: { name?: string; args?: Record<string, unknown> };
        }[];
      };
    }[];
  };

  const parts = j.candidates?.[0]?.content?.parts ?? [];

  // A turn can carry both prose and a tool call; the prose is the answer and
  // the tool call is what goes on screen beneath it.
  return {
    text: parts
      .map((p) => p.text ?? "")
      .join("")
      .trim(),
    calls: parts
      .filter((p) => p.functionCall?.name)
      .map((p) => ({ name: p.functionCall!.name!, args: p.functionCall!.args ?? {} })),
  };
}

function readOpenAI(json: unknown): { text: string; calls: ToolCall[] } {
  const j = (json ?? {}) as {
    status?: string;
    incomplete_details?: { reason?: string };
    output?: {
      type?: string;
      name?: string;
      arguments?: string;
      content?: { type?: string; text?: string }[];
    }[];
  };

  if (j.status === "incomplete") {
    // Worth a line: the usual cause is a reasoning model eating the whole
    // output budget, which looks exactly like the model saying nothing.
    console.warn(`llm: openai response incomplete — ${j.incomplete_details?.reason ?? "unknown"}`);
  }

  const items = j.output ?? [];

  const text = items
    .filter((i) => i.type === "message")
    .flatMap((i) => i.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();

  const calls: ToolCall[] = [];
  for (const item of items) {
    if (item.type !== "function_call" || !item.name) continue;
    // Arguments arrive as a JSON string, and a truncated response can leave
    // it unparseable. A dropped tool call is better than a thrown request.
    try {
      const args = JSON.parse(item.arguments ?? "{}");
      calls.push({ name: item.name, args: args && typeof args === "object" ? args : {} });
    } catch {
      console.warn(`llm: openai sent unparseable arguments for ${item.name}`);
    }
  }

  return { text, calls };
}

/* ------------------------------------------------------------ conversion */

/**
 * Gemini function declarations to OpenAI tools.
 *
 * Two differences and nothing else: OpenAI puts each tool at the top level
 * with `type: "function"` rather than nesting them under a
 * `functionDeclarations` array, and its parameter types are lowercase JSON
 * Schema where Gemini's are uppercase.
 */
export function toolsForOpenAI(blocks: ToolBlock[]) {
  return blocks.flatMap((b) =>
    (b.functionDeclarations ?? [])
      .filter((f) => f.name)
      .map((f) => ({
        type: "function" as const,
        name: f.name!,
        description: f.description ?? "",
        parameters: (toJsonSchema(f.parameters ?? {}) ?? {}) as Record<string, unknown>,
        strict: false,
      })),
  );
}

/**
 * Gemini's schema dialect to plain JSON Schema.
 *
 * Uppercase type names become lowercase, and `nullable: true` — which is
 * OpenAPI, not JSON Schema — becomes a union with null, which is how a JSON
 * Schema says the same thing. Everything else passes through untouched.
 */
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (!node || typeof node !== "object") return node;

  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(src)) {
    if (k === "nullable") continue;
    if (k === "type" && typeof v === "string") {
      out.type = v.toLowerCase();
      continue;
    }
    out[k] = toJsonSchema(v);
  }

  if (src.nullable === true && typeof out.type === "string") {
    out.type = [out.type, "null"];
  }
  return out;
}

/* ------------------------------------------------------- model selection */

function pin(p: Provider): string | null {
  if (p === "openai") return pinnedOpenAI();
  if (p === "sarvam") return pinnedSarvam();
  return pinnedGemini("chat");
}

function preferred(p: Provider): string {
  if (p === "openai") return preferredOpenAIModel();
  if (p === "sarvam") return preferredSarvamModel();
  return preferredGemini("chat");
}

function remember(p: Provider, model: string): void {
  if (p === "openai") rememberOpenAIModel(model);
  // Sarvam has nothing to remember: there is no discovery, so the model never
  // changes out from under us and the name in the config is the name used.
  else if (p === "gemini") rememberGemini("chat", model);
}

function discover(p: Provider, key: string, exclude: string[]): Promise<string | null> {
  if (p === "openai") return discoverOpenAIModel(key, exclude);
  if (p === "sarvam") return discoverSarvamModel();
  return discoverGemini(key, "chat", exclude);
}

/* ------------------------------------------------------------- plumbing */

function openaiHeaders(key: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

function geminiHeaders(key: string): Record<string, string> {
  return { "Content-Type": "application/json", "x-goog-api-key": key };
}

/**
 * Our tool declarations in the shape chat completions wants.
 *
 * Not the same as `toolsForOpenAI` above, and the difference is easy to miss:
 * the Responses API takes a flat `{type, name, parameters}` and chat
 * completions nests it as `{type, function: {name, parameters}}`. Sending one
 * where the other is expected is a 400 that reads like a schema problem.
 */
function toolsForChat(blocks: ToolBlock[]) {
  return blocks.flatMap((b) =>
    (b.functionDeclarations ?? [])
      .filter((f) => f.name)
      .map((f) => ({
        type: "function" as const,
        function: {
          name: f.name!,
          description: f.description ?? "",
          parameters: (toJsonSchema(f.parameters ?? {}) ?? {}) as Record<string, unknown>,
        },
      })),
  );
}

/**
 * Our turns as chat-completions messages.
 *
 * The system prompt is a message here rather than a separate field, which is
 * the one structural difference from both other providers.
 */
function chatMessages(system: string, turns: Turn[]) {
  return [
    { role: "system", content: system },
    ...turns.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text })),
  ];
}

/**
 * What came back from a chat-completions response.
 *
 * `content` is null on a pure tool call, and `arguments` is a JSON string
 * rather than an object — both are the documented shape, and both are the
 * kind of thing that silently yields an empty answer if assumed otherwise.
 */
/** Whichever reader this provider's response needs. */
function readFor(p: Provider, json: unknown): { text: string; calls: ToolCall[] } {
  if (p === "openai") return readOpenAI(json);
  if (p === "sarvam") return readChat(json);
  return readGemini(json);
}

function readChat(json: unknown): { text: string; calls: ToolCall[] } {
  const j = (json ?? {}) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: { function?: { name?: string; arguments?: string } }[];
      };
      finish_reason?: string;
    }[];
  };

  const message = j.choices?.[0]?.message;
  const calls: ToolCall[] = [];

  for (const call of message?.tool_calls ?? []) {
    const name = call.function?.name;
    if (!name) continue;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.function?.arguments ?? "{}") as Record<string, unknown>;
    } catch {
      // A model that produced unparseable arguments has not called the tool,
      // whatever it thinks. Dropping it is better than passing junk to code
      // that will write to somebody's resume with it.
      console.warn(`llm: unparseable arguments for ${name}`);
      continue;
    }
    calls.push({ name, args });
  }

  return { text: message?.content ?? "", calls };
}
