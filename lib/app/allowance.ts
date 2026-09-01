import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * What this person may do, and recording what they did.
 *
 * Both answers come from the database, through a security-definer function
 * the browser's role cannot execute. That is the whole design: a limit the
 * client can compute is a limit the client can ignore, and every one of these
 * numbers is money.
 *
 * The counters are spent *after* the work succeeds. A message that failed
 * upstream is not charged — being billed for an error is the sort of thing
 * people remember about a product — and voice is charged on the seconds the
 * socket was actually open rather than what it was allocated.
 */

export type Allowance = {
  paid: boolean;
  /** Text messages left today. */
  messagesLeft: number;
  /** Seconds of live voice left. For free accounts this is the lifetime trial. */
  voiceLeft: number;
  /** True when voiceLeft is the one-time trial rather than a daily allowance. */
  voiceIsTrial: boolean;
};

/** Below this a call is not worth starting; it would end mid-sentence. */
export const MIN_VOICE_SECONDS = 30;

const FALLBACK: Allowance = {
  paid: false,
  messagesLeft: 0,
  voiceLeft: 0,
  voiceIsTrial: true,
};

type Raw = {
  paid?: boolean;
  messages_left?: number;
  voice_left?: number;
  voice_is_trial?: boolean;
};

function read(data: unknown): Allowance | null {
  if (!data || typeof data !== "object") return null;
  const r = data as Raw;
  if (typeof r.messages_left !== "number" || typeof r.voice_left !== "number") return null;
  return {
    paid: !!r.paid,
    messagesLeft: r.messages_left,
    voiceLeft: r.voice_left,
    voiceIsTrial: !!r.voice_is_trial,
  };
}

/**
 * How much is left.
 *
 * Fails closed. If the function is missing or the call errors, nobody gets a
 * free run at an unmetered model — the schema not being deployed is our
 * problem, and the safe direction for our problem is "no".
 */
export async function getAllowance(userId: string): Promise<Allowance> {
  const db = createAppAdminClient();
  if (!db) return FALLBACK;

  const { data, error } = await db.rpc("agent_allowance", { p_user: userId });
  if (error) {
    console.error("allowance: agent_allowance failed —", error.message);
    return FALLBACK;
  }
  return read(data) ?? FALLBACK;
}

/** Record usage and return what remains. */
export async function spend(
  userId: string,
  used: { messages?: number; seconds?: number },
): Promise<Allowance> {
  const db = createAppAdminClient();
  if (!db) return FALLBACK;

  const { data, error } = await db.rpc("agent_spend", {
    p_user: userId,
    p_messages: Math.max(0, Math.round(used.messages ?? 0)),
    // Clamped: only the client knows how long it talked, and a client that
    // can report any number can also report zero. The daily and monthly caps
    // are the real defence, but a single absurd report should not be able to
    // wipe out a month in one request either.
    p_seconds: Math.min(Math.max(0, Math.round(used.seconds ?? 0)), 15 * 60),
  });

  if (error) {
    console.error("allowance: agent_spend failed —", error.message);
    return FALLBACK;
  }
  return read(data) ?? FALLBACK;
}

/* ------------------------------------------------------------------ words */

/** What to tell somebody who has run out. Never a number without a next step. */
export function outOfMessages(paid: boolean): string {
  return paid
    ? "That's today's messages. They reset at midnight."
    : "That's your ten free messages for today. Pro is unlimited — and the agent can talk.";
}

export function outOfVoice(a: Allowance): string {
  if (!a.paid) {
    return a.voiceLeft === 0 && a.voiceIsTrial
      ? "Your free voice trial is used up. Pro gets you ten minutes a day."
      : "Live voice is part of Pro.";
  }
  return "That's today's voice. It resets at midnight — typing still works.";
}
