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

export type Provider = "openai" | "gemini";

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

export function provider(): Provider | null {
  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced === "openai" || forced === "gemini") {
    return apiKey(forced) ? forced : null;
  }
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  return null;
}

function apiKey(p: Provider): string | null {
  const key = p === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
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
  const read = p === "openai" ? readOpenAI(json) : readGemini(json);
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

  try {
    for await (const frame of sse(result.res)) {
      if (frame === "[DONE]") break;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(frame) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (p === "openai") {
        const type = event.type as string | undefined;
        if (type === "response.output_text.delta") {
          const delta = event.delta;
          if (typeof delta === "string" && delta) {
            text += delta;
            onDelta(delta);
          }
        } else if (type === "response.completed" || type === "response.incomplete") {
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
      }
    }
  } catch (e) {
    // The stream broke partway. Whatever arrived is still a real answer, and
    // showing it beats replacing it with an apology.
    console.error(`llm: ${p}/${result.model} stream broke —`, String(e).slice(0, 200));
    if (!text) return { ok: false, error: "The answer was cut off. Ask again.", status: 502 };
  }

  if (upstreamError) console.error(`llm: ${p}/${result.model} streamed an error`, upstreamError);

  if (!text && !calls.length) {
    console.error(`llm: ${p}/${result.model} streamed nothing usable`, upstreamError ?? "");
    return { ok: false, error: "The model returned nothing.", status: 502 };
  }

  return { ok: true, text, calls, provider: p, model: result.model };
}

/* ------------------------------------------------------- shared plumbing */

type Ready =
  | { ok: true; p: Provider; key: string; turns: Turn[] }
  | { ok: false; fail: LlmFail };

/** The two refusals both chat paths share, decided once. */
function prepare(input: ChatInput): Ready {
  const p = provider();
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

  return (model: string, drop: Set<Drop>): Built =>
    p === "openai"
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
}): Promise<JsonOk | LlmFail> {
  const p = provider();
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
    build: (model, drop) =>
      p === "openai"
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
          },
  });

  if (!result.ok) return failure(result, p);

  const json = await result.res.json().catch(() => null);
  const read = p === "openai" ? readOpenAI(json) : readGemini(json);
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
      p === "openai" ? "check OPENAI_API_KEY" : "check GEMINI_API_KEY",
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
  return p === "openai" ? pinnedOpenAI() : pinnedGemini("chat");
}

function preferred(p: Provider): string {
  return p === "openai" ? preferredOpenAIModel() : preferredGemini("chat");
}

function remember(p: Provider, model: string): void {
  if (p === "openai") rememberOpenAIModel(model);
  else rememberGemini("chat", model);
}

function discover(p: Provider, key: string, exclude: string[]): Promise<string | null> {
  return p === "openai"
    ? discoverOpenAIModel(key, exclude)
    : discoverGemini(key, "chat", exclude);
}

/* ------------------------------------------------------------- plumbing */

function openaiHeaders(key: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

function geminiHeaders(key: string): Record<string, string> {
  return { "Content-Type": "application/json", "x-goog-api-key": key };
}
