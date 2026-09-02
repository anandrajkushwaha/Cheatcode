import "server-only";
import { isOwnerEmail } from "@/lib/analytics/owner";
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
  /**
   * False when the database could not answer at all.
   *
   * Distinguished from "you have none left" because the two need completely
   * different sentences. The first version collapsed them, so an account that
   * had never sent a message was told it had used its ten for the day — which
   * is not a limit, it is the meter itself being missing, and blaming the
   * person for our deployment is the worst kind of error message.
   */
  configured: boolean;
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

/**
 * The account that has to be able to test the thing.
 *
 * Somebody has to sit on a twenty-minute call to find out whether the agent
 * loses the thread, and doing that from a normal account means either burning
 * a real allowance or quietly raising everybody's limits to suit one person —
 * which is how a product's economics get set by whoever was debugging that
 * week.
 *
 * So the meter still runs for owners: usage is recorded, spend rows are
 * written, and ai_usage stays truthful about what testing cost. Only the
 * refusal is lifted.
 */
function unlimited(): Allowance {
  return {
    configured: true,
    paid: true,
    messagesLeft: Number.MAX_SAFE_INTEGER,
    voiceLeft: 60 * 60,
    voiceIsTrial: false,
  };
}

/**
 * No meter. What that means depends on where we are running.
 *
 * In production it fails closed: an unmetered model is an open tab, and the
 * schema not being deployed is our problem, not a reason to give it away.
 *
 * On a development machine it fails open, because the alternative is that
 * nobody can try the agent locally until they have run a migration against a
 * shared database — which turns a two-minute test into a chore and, worse,
 * makes "you've used your ten free messages" the first thing a developer sees
 * on a fresh checkout. The log line says exactly what to run.
 */
const DEV = process.env.NODE_ENV !== "production";

const UNCONFIGURED: Allowance = {
  configured: false,
  paid: DEV,
  messagesLeft: DEV ? 999 : 0,
  voiceLeft: DEV ? 600 : 0,
  voiceIsTrial: !DEV,
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
    configured: true,
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
export async function getAllowance(userId: string, email?: string | null): Promise<Allowance> {
  if (isOwnerEmail(email)) return unlimited();

  const db = createAppAdminClient();
  if (!db) return UNCONFIGURED;

  const { data, error } = await db.rpc("agent_allowance", { p_user: userId });
  if (error) {
    console.error(
      "allowance: agent_allowance failed —",
      error.message,
      "— run supabase/schemas/42_agent_limits.sql",
    );
    return UNCONFIGURED;
  }
  return read(data) ?? UNCONFIGURED;
}

/** Record usage and return what remains. */
export async function spend(
  userId: string,
  used: { messages?: number; seconds?: number },
  email?: string | null,
): Promise<Allowance> {
  const db = createAppAdminClient();
  if (!db) return UNCONFIGURED;

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
    return UNCONFIGURED;
  }

  // Recorded either way — an owner's testing costs real money and should show
  // up in the numbers. It just does not run them out.
  if (isOwnerEmail(email)) return unlimited();
  return read(data) ?? UNCONFIGURED;
}

/* ------------------------------------------------------------------ words */

/** What to tell somebody who has run out. Never a number without a next step. */
export function outOfMessages(a: Allowance): string {
  if (!a.configured) return NOT_SET_UP;
  return a.paid
    ? "That's today's messages. They reset at midnight."
    : "That's your ten free messages for today. Pro is unlimited — and the agent can talk.";
}

/**
 * Said when the meter is missing rather than empty.
 *
 * Deliberately not "something went wrong": whoever sees this on a live site
 * is usually the person who can fix it, and naming the file is the whole
 * difference between a shrug and a two-minute fix.
 */
export const NOT_SET_UP =
  "The agent isn't set up on this server yet — its limits table is missing.";

export function outOfVoice(a: Allowance): string {
  if (!a.configured) return NOT_SET_UP;
  if (!a.paid) {
    return a.voiceLeft === 0 && a.voiceIsTrial
      ? "Your free voice trial is used up. Pro gets you ten minutes a day."
      : "Live voice is part of Pro.";
  }
  return "That's today's voice. It resets at midnight — typing still works.";
}
