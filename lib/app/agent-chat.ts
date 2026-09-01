import "server-only";
import { systemInstruction, TOOLS, type Grounding } from "@/lib/app/agent-brain";
import { readShowJobs, type ShowJobs } from "@/lib/app/agent-types";

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

/**
 * Pinned, not `-latest`.
 *
 * `gemini-flash-latest` was here, and Google hot-swaps what that alias points
 * at with two weeks' notice. An agent whose behaviour was tuned against one
 * model and silently moved to another is a product that changes personality
 * on a Tuesday for no reason anybody can find. 2.5-flash is also the older,
 * better-provisioned model, which matters here for the reason below.
 */
const MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash";
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

  let response: Response | null = null;
  let lastStatus = 0;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (attempt > 0) await wait(400 * 2 ** (attempt - 1) + Math.random() * 250);

    try {
      response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
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

    if (response.ok) break;
    lastStatus = response.status;
    if (!RETRY_STATUSES.has(response.status)) break;
    response = null;
  }

  if (!response || !response.ok) {
    // Say what happened in words. A status code in the middle of a
    // conversation tells the person nothing they can act on.
    if (lastStatus === 503 || lastStatus === 500 || lastStatus === 502 || lastStatus === 504) {
      return { ok: false, error: "Google's model is busy right now. Try that again." };
    }
    if (lastStatus === 429) {
      return { ok: false, error: "Too many requests in a row. Give it a few seconds." };
    }
    if (lastStatus === 400) {
      console.error("agent-chat: rejected by the model", await response?.text());
      return { ok: false, error: "That request wasn't accepted. Try rewording it." };
    }
    if (lastStatus === 403 || lastStatus === 401) {
      console.error("agent-chat: key rejected", lastStatus);
      return { ok: false, error: "The agent isn't switched on properly yet." };
    }
    if (lastStatus === 404) {
      console.error("agent-chat: no such model", MODEL);
      return { ok: false, error: "The agent's model is misconfigured." };
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

