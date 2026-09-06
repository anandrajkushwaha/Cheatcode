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
  provider: "openai" | "gemini" | "sarvam";
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
    cost_usd: costOf(input.model, usage, input.durationSeconds),
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
 * sees, so unlike every text call there is no response body here to read a
 * usage block out of. But there *is* one on the wire: both providers report
 * per-response token counts to the browser, and the browser now forwards them.
 *
 * That is a report rather than a measurement we made, and the route clamps it
 * before it arrives. It is still the right trade: for weeks this recorded
 * nothing, so a ten-minute spoken conversation — the most expensive thing the
 * product does — showed up as `0 in · 0 out`, and voice was the one feature
 * whose cost nobody could see.
 *
 * What is still refused is estimating tokens from the duration. An estimate
 * sitting in a column next to measured values is a number that will be read as
 * measured, and the estimator on the Settings screen is where guesses belong —
 * labelled, and next to the assumptions they came from.
 */
export function recordVoiceCall(input: {
  userId: string;
  sessionId?: string | null;
  model: string;
  seconds: number;
  /**
   * Who actually served it. Was hardcoded to OpenAI, which stopped being true
   * the moment the settings screen could route voice to Gemini — and a row
   * that names the wrong provider is a row that gets priced against the wrong
   * rate card.
   */
  provider?: "openai" | "gemini";
  /** What the provider reported, already bounded by the route. */
  usage?: TokenUsage | null;
}): void {
  recordUsage({
    feature: "voice_conversation",
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    provider: input.provider ?? "openai",
    model: input.model,
    usage: input.usage ?? {},
    durationSeconds: input.seconds,
  });
}

export type { Feature };

/* ------------------------------------------------- what a browser claims */

/**
 * A ceiling on any single token count a client may claim.
 *
 * The realtime API bills audio at 600 input and 1,200 output tokens a minute,
 * and re-sends the conversation on every response, so a long session's *input*
 * total legitimately runs to millions. Ten million is far above anything a
 * fifteen-minute report can honestly contain and far below a number that could
 * distort the dashboard — the point is to bound a hostile client, not to
 * second-guess an honest one.
 */
const MAX_TOKENS_PER_REPORT = 10_000_000;

/**
 * The token counts, taken as a report rather than as a fact.
 *
 * The same trust position as `seconds`: only the browser can see what the
 * provider said, so the number cannot be verified — but it can be bounded, and
 * a bounded measurement is worth far more than the null this used to record.
 * Anything malformed drops to zero rather than failing the request; losing an
 * accounting row must never cost somebody their transcript.
 */
export function readUsageReport(raw: unknown): {
  input: number;
  output: number;
  audioInput: number;
  audioOutput: number;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0
      ? Math.min(Math.round(v), MAX_TOKENS_PER_REPORT)
      : 0;

  const usage = {
    input: n(r.input),
    output: n(r.output),
    audioInput: n(r.audioInput),
    audioOutput: n(r.audioOutput),
  };

  // All zeros is the same as not reporting: recording it would write a row
  // that costs $0, which is the exact claim this whole change exists to stop.
  return usage.input + usage.output + usage.audioInput + usage.audioOutput > 0 ? usage : null;
}
