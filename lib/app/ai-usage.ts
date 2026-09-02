import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { costOf, type Feature, type TokenUsage, type UsageMeta } from "@/lib/app/ai-cost";

/**
 * Write down what a model call cost.
 *
 * Three decisions worth stating, because each one is the opposite of the
 * obvious choice:
 *
 * **It never throws and it is never awaited by the caller.** Somebody asking
 * the agent a question does not care whether our accounting worked, and a
 * failed insert must not turn a good answer into an error. Every failure ends
 * in the log and nowhere else.
 *
 * **It writes with the admin client.** The row is a record about the user, not
 * a row belonging to them: they must not be able to edit or delete it, and it
 * has to be written even when there is no session — a scheduled job or an
 * anonymous path still spends money. Reads are the other way round, and the
 * policy in 60_ai_usage.sql lets somebody see their own usage and nothing else.
 *
 * **A missing table is not an error.** The migration may not have been run on
 * every deployment yet, and an unmigrated database should cost the product a
 * warning, not every model call.
 */

export type RecordInput = UsageMeta & {
  provider: "openai" | "gemini";
  model: string;
  usage: TokenUsage;
  /** For realtime, which is billed by wall clock as much as by tokens. */
  durationSeconds?: number;
};

let warned = false;

export function recordUsage(input: RecordInput): void {
  // Fire and forget. The `void` is load-bearing: awaiting this would put the
  // accounting on the critical path of every answer.
  void write(input).catch((e) => {
    console.error("ai-usage: could not record —", String(e).slice(0, 200));
  });
}

async function write(input: RecordInput): Promise<void> {
  const supabase = createAppAdminClient();
  if (!supabase) {
    if (!warned) {
      warned = true;
      console.warn("ai-usage: no service key, so nothing is being costed.");
    }
    return;
  }

  const { usage } = input;
  const { error } = await supabase.from("ai_usage").insert({
    user_id: input.userId ?? null,
    session_id: input.sessionId ?? null,
    feature: input.feature,
    provider: input.provider,
    model: input.model,
    input_tokens: usage.input ?? null,
    output_tokens: usage.output ?? null,
    audio_input_tokens: usage.audioInput ?? null,
    audio_output_tokens: usage.audioOutput ?? null,
    duration_seconds: input.durationSeconds ?? null,
    cost_usd: costOf(input.model, usage),
  });

  if (error) {
    if (/relation .*ai_usage.* does not exist|schema cache/i.test(error.message)) {
      if (!warned) {
        warned = true;
        console.warn(
          "ai-usage: table missing — run supabase/schemas/60_ai_usage.sql. " +
            "Model calls still work; nothing is being costed.",
        );
      }
      return;
    }
    console.error("ai-usage: insert failed —", error.message.slice(0, 200));
  }
}

/**
 * A voice call, priced on the way out.
 *
 * The realtime session bills through a WebRTC connection the server never
 * sees, so unlike every text call there is no response body to read a usage
 * block out of. What we have is the duration the browser reports, which the
 * allowance system already collects and bills against — this records the same
 * number in money.
 *
 * The token counts are left null on purpose rather than estimated from the
 * duration. An estimate in a column next to measured values is a number that
 * will be read as measured.
 */
export function recordVoiceCall(input: {
  userId: string;
  sessionId?: string | null;
  model: string;
  seconds: number;
}): void {
  recordUsage({
    feature: "voice_conversation",
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    provider: "openai",
    model: input.model,
    usage: {},
    durationSeconds: input.seconds,
  });
}

export type { Feature };
