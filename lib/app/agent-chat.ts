import "server-only";
import { systemInstruction, TOOLS, type Grounding } from "@/lib/app/agent-brain";
import { readShowJobs, type ShowJobs } from "@/lib/app/agent-types";
import { llmChat, llmChatStream, type ChatOk as LlmOk, type LlmFail, type Turn } from "@/lib/app/llm";

/**
 * The agent's answer, in text.
 *
 * The typed half of the same agent. Everything about how it behaves lives in
 * agent-brain.ts, which the live voice session reads too — this file is only
 * the shape of a turn: what goes in, what comes back, and what the screen
 * does with it.
 *
 * The transport underneath is lib/app/llm.ts, which decides the provider and
 * owns the retries. This file used to own all of that as well, and it meant
 * the retry logic existed in three places and only one of them was any good.
 *
 * Voice and text differ in exactly one place (`channelNote`) and share
 * everything else, so a rule written once applies to both.
 */

export type { Turn } from "@/lib/app/llm";
export type { ShowJobs } from "@/lib/app/agent-types";

/** Enough context to hold a thread, short enough to stay cheap. */
const MAX_TURNS = 10;
const MAX_CHARS = 1200;

export type ChatOk = { ok: true; reply: string; show?: ShowJobs };
export type ChatFail = { ok: false; error: string };

export async function agentReply(
  input: { turns: Turn[] } & Grounding,
): Promise<ChatOk | ChatFail> {
  return finish(await llmChat(request(input)));
}

/**
 * The same reply, arriving as it is written.
 *
 * `onDelta` gets each new fragment. What comes back at the end is identical
 * to `agentReply` — the cards in particular are only known once the turn is
 * complete, because a job the model was still deciding to mention is not a
 * job to put on screen.
 */
export async function agentReplyStream(
  input: { turns: Turn[] } & Grounding,
  onDelta: (chunk: string) => void,
): Promise<ChatOk | ChatFail> {
  return finish(await llmChatStream(request(input), onDelta));
}

/** What goes up, built once so the two paths cannot drift. */
function request(input: { turns: Turn[] } & Grounding) {
  return {
    system: systemInstruction("text", input),
    turns: input.turns
      .filter((t) => t.text.trim())
      .slice(-MAX_TURNS)
      .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_CHARS) })),
    tools: TOOLS,
    temperature: 0.4,
    maxTokens: 400,
  };
}

/** What comes back, read once for the same reason. */
function finish(result: LlmOk | LlmFail): ChatOk | ChatFail {
  if (!result.ok) return { ok: false, error: result.error };

  // A turn can carry both prose and a tool call; the prose is the answer and
  // the cards are what go on screen beneath it.
  const call = result.calls.find((c) => c.name === "show_jobs");
  const show = readShowJobs(call?.args);

  if (!result.text && !show) return { ok: false, error: "The model returned nothing." };

  return {
    ok: true,
    reply: result.text.slice(0, 2000) || "Here's what fits.",
    ...(show ? { show } : {}),
  };
}
