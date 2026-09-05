import "server-only";
import { systemInstruction, type Grounding } from "@/lib/app/agent-brain";
import { isServerTool, runTool, TOOLS } from "@/lib/app/agent-tools";
import { readShowJobs, type ShowJobs, type UiAction } from "@/lib/app/agent-types";
import { llmChat, llmChatStream, type ChatOk as LlmOk, type LlmFail, type Turn } from "@/lib/app/llm";
import type { UsageMeta } from "@/lib/app/ai-cost";

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

export type ChatOk = {
  ok: true;
  reply: string;
  show?: ShowJobs;
  /** What the tools it ran asked the screen to do. */
  actions?: UiAction[];
};
export type ChatFail = { ok: false; error: string };

export async function agentReply(
  input: { turns: Turn[]; meta: UsageMeta } & Grounding,
): Promise<ChatOk | ChatFail> {
  return withTools(input, (turns, tools) => llmChat(request(input, turns, tools)));
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
  input: { turns: Turn[]; meta: UsageMeta } & Grounding,
  onDelta: (chunk: string) => void,
): Promise<ChatOk | ChatFail> {
  return withTools(input, (turns, tools) =>
    llmChatStream(request(input, turns, tools), onDelta),
  );
}

/**
 * Let the model use a tool, then let it speak.
 *
 * At most two rounds, and the second one is handed no tools at all. That cap
 * is the cost control: a tool-using turn can never be more than two model
 * calls, and it cannot loop. The second round having no tools is also what
 * stops the model calling the same one again — it has just been told the
 * result in words, and words are all it can answer with.
 *
 * The tool exchange is replayed as ordinary turns rather than as the
 * providers' formal tool-result messages. That is a deliberate simplification:
 * the formal protocol is spelled differently by each provider and would need
 * new turn types threaded through both request builders, to gain nothing here.
 * The spoken channel, where tool use actually matters, uses the real protocol
 * because the realtime API gives it for free.
 */
async function withTools(
  input: { turns: Turn[]; meta: UsageMeta } & Grounding,
  call: (turns: Turn[], tools: typeof TOOLS | undefined) => Promise<LlmOk | LlmFail>,
): Promise<ChatOk | ChatFail> {
  const first = await call(input.turns, TOOLS);
  if (!first.ok) return { ok: false, error: first.error };

  const server = first.calls.filter((c) => isServerTool(c.name));
  if (!server.length) return finish(first);

  const userId = input.meta.userId;
  if (!userId) {
    console.warn("agent-chat: a tool was called with no user to run it as");
    return finish(first);
  }

  const actions: UiAction[] = [];
  const told: string[] = [];

  for (const c of server) {
    const result = await runTool(c.name, c.args, {
      userId,
      // The session this résumé is being written in, so the admin screen can
      // put the two next to each other.
      conversationId: input.meta.sessionId ?? null,
    });
    if (result.action) actions.push(result.action);
    told.push(`${c.name}: ${result.summary}`);
  }

  const second = await call(
    [
      ...input.turns,
      // What it said on the way to calling the tool, if anything.
      ...(first.text ? [{ role: "model" as const, text: first.text }] : []),
      {
        role: "user" as const,
        text:
          `[system] Your tools ran. ${told.join(" ")} ` +
          `Now reply to them in your own words. Do not list what you saved — ` +
          `mention it in a clause at most, and carry on.`,
      },
    ],
    undefined,
  );

  if (!second.ok) {
    // The tools did run. Losing the sentence about them is a worse outcome
    // than a slightly blunt reply, so the first round's text stands in.
    return first.text
      ? { ok: true, reply: first.text.slice(0, 2000), ...(actions.length ? { actions } : {}) }
      : { ok: false, error: second.error };
  }

  const out = finish(second);
  return out.ok && actions.length ? { ...out, actions } : out;
}

/** What goes up, built once so the two paths cannot drift. */
function request(
  input: { turns: Turn[]; meta: UsageMeta } & Grounding,
  turns: Turn[],
  tools: typeof TOOLS | undefined,
) {
  return {
    meta: input.meta,
    system: systemInstruction("text", input),
    turns: turns
      .filter((t) => t.text.trim())
      .slice(-MAX_TURNS)
      .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_CHARS) })),
    ...(tools ? { tools } : {}),
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
