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

const MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-flash-latest";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

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

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction("text", input) }] },
        contents: turns,
        tools: TOOLS,
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "That took too long. Ask again." : "Could not reach the model.",
    };
  }

  if (response.status === 429) return { ok: false, error: "Too many requests. One moment." };
  if (!response.ok) return { ok: false, error: `The model returned ${response.status}.` };

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

