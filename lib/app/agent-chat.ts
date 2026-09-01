import "server-only";
import { systemInstruction, TOOLS, type Grounding } from "@/lib/app/agent-brain";
import { readShowJobs, type ShowJobs } from "@/lib/app/agent-types";
import { discoverModel, pinned, preferredModel, rememberModel } from "@/lib/app/gemini-models";

/**
 * The agent's answer, in text.
 *
 * The typed half of the same agent. Everything about how it behaves lives in
 * agent-brain.ts, which the live voice session reads too — this file is only
 * the transport: one request, one answer, no socket.
 *
 * Voice and text differ in exactly one place (`channelNote`) and share
 * everything else, so a rule written once applies to both.
 */

// Overridable so the retry path can be driven against a server that returns
// 503 on demand. Google's own 503s are not reproducible to order, and retry
// code that has never actually retried is a guess.
const ENDPOINT =
  process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * 503 means Google is busy, not that anything is wrong.
 *
 * It is common enough on the free tier to be the normal case rather than the
 * exception, and the first version of this treated it as fatal and printed
 * the status code at the person — which is both useless to them and gives up
 * on a request that would almost certainly have worked a second later.
 *
 * Three attempts, backing off, with jitter so a burst of users does not
 * retry in lockstep and make the overload worse.
 */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const ATTEMPTS = 3;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Turn = { role: "user" | "model"; text: string };

export type { ShowJobs } from "@/lib/app/agent-types";

/** Enough context to hold a thread, short enough to stay cheap. */
const MAX_TURNS = 10;
const MAX_CHARS = 1200;

export type ChatOk = { ok: true; reply: string; show?: ShowJobs };
export type ChatFail = { ok: false; error: string };

export async function agentReply(
  input: { turns: Turn[] } & Grounding,
): Promise<ChatOk | ChatFail> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "The agent isn't switched on yet." };

  const turns = input.turns
    .filter((t) => t.text.trim())
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role, parts: [{ text: t.text.slice(0, MAX_CHARS) }] }));

  if (!turns.length) return { ok: false, error: "Nothing to answer." };

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction("text", input) }] },
    contents: turns,
    tools: TOOLS,
    generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
  });

  let model = preferredModel("chat");
  const tried: string[] = [];
  let discovered = false;
  /** One switch to a different model after load, not an endless walk. */
  let swapped = false;

  let response: Response | null = null;
  let lastStatus = 0;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await wait(400 * 2 ** (attempt - 1) + Math.random() * 250);

    try {
      response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(25_000),
      });
    } catch (e) {
      // A timeout is worth one more go; anything else is the network, and
      // retrying a dead network just makes them wait longer to hear it.
      if (e instanceof Error && e.name === "TimeoutError" && attempt < ATTEMPTS - 1) continue;
      return {
        ok: false,
        error:
          e instanceof Error && e.name === "TimeoutError"
            ? "That took too long. Ask again."
            : "Could not reach the model.",
      };
    }

    if (response.ok) {
      rememberModel("chat", model);
      break;
    }
    lastStatus = response.status;

    // 404 means this key cannot reach that model. Ask what it can reach, once,
    // and try again with the answer. Not done when the model was set by hand:
    // an explicit choice that is wrong should say so, not be quietly replaced.
    if (response.status === 404 && !pinned("chat") && !discovered) {
      discovered = true;
      tried.push(model);
      const found = await discoverModel(key, "chat", tried);
      if (found && found !== model) {
        model = found;
        response = null;
        // Not one of the three. The attempts exist to ride out load; finding
        // out we were asking the wrong address is a different problem, and
        // spending a retry on it left only two for the thing that needed them.
        attempt--;
        continue;
      }
    }

    if (!RETRY_STATUSES.has(response.status)) break;
    response = null;

    // Overload is per model, not per key. Having spent our retries being told
    // this one is busy, ask for a different one rather than reporting failure
    // — Google is rarely out of capacity on everything at once.
    if (attempt === ATTEMPTS - 1 && !swapped && !pinned("chat") && lastStatus >= 500) {
      swapped = true;
      if (!tried.includes(model)) tried.push(model);
      const other = await discoverModel(key, "chat", tried);
      if (other) {
        console.info(`agent-chat: ${model} is overloaded, trying ${other}`);
        model = other;
        attempt = -1; // a fresh set of attempts for a model we have not tried
      }
    }
  }

  if (!response || !response.ok) {
    // Google's own message, in the server log. The person gets a sentence
    // they can act on; whoever is running the app needs the real text, and
    // for two rounds it was thrown away and the debugging was guesswork.
    if (response) {
      console.error(
        `agent-chat: ${model} returned ${lastStatus}`,
        (await response.text().catch(() => "")).slice(0, 600),
      );
    }

    // Say what happened in words. A status code in the middle of a
    // conversation tells the person nothing they can act on.
    if (lastStatus === 503 || lastStatus === 500 || lastStatus === 502 || lastStatus === 504) {
      return { ok: false, error: "Google's model is busy right now. Try that again." };
    }
    if (lastStatus === 429) {
      return { ok: false, error: "Too many requests in a row. Give it a few seconds." };
    }
    if (lastStatus === 400) {
      return { ok: false, error: "That request wasn't accepted. Try rewording it." };
    }
    if (lastStatus === 403 || lastStatus === 401) {
      console.error("agent-chat: key rejected", lastStatus);
      return { ok: false, error: "The agent isn't switched on properly yet." };
    }
    if (lastStatus === 404) {
      console.error(
        "agent-chat: no model this key can reach",
        pinned("chat")
          ? `(GEMINI_CHAT_MODEL is set to "${pinned("chat")}")`
          : "(discovery found nothing usable)",
      );
      return {
        ok: false,
        error: pinned("chat")
          ? "GEMINI_CHAT_MODEL is set to a model this key cannot use."
          : "No usable model on this API key.",
      };
    }
    return { ok: false, error: "The agent couldn't answer that. Try again." };
  }

  const json = (await response.json()) as {
    candidates?: {
      content?: {
        parts?: {
          text?: string;
          functionCall?: { name?: string; args?: Record<string, unknown> };
        }[];
      };
    }[];
  };

  const parts = json.candidates?.[0]?.content?.parts ?? [];

  // A turn can carry both prose and a tool call; the prose is the answer and
  // the tool call is what goes on screen beneath it.
  const reply = parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  const call = parts.find((p) => p.functionCall?.name === "show_jobs")?.functionCall;
  const show = readShowJobs(call?.args);

  if (!reply && !show) return { ok: false, error: "The model returned nothing." };

  return {
    ok: true,
    reply: reply.slice(0, 2000) || "Here's what fits.",
    ...(show ? { show } : {}),
  };
}

