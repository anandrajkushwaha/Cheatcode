/**
 * What a model call costs, in one place.
 *
 * Two rules make this worth having as a module rather than a column default.
 *
 * The first is that a price is a fact about a day. Rates change; what a call
 * cost on the day it was made does not. So the number is worked out at write
 * time and stored, and nothing recomputes it later — recomputing is how you
 * end up with a figure that cannot be reconciled against an invoice.
 *
 * The second is that an unknown model must not silently cost nothing. A new
 * model name appearing — which happens here on its own, because the model
 * registry discovers names it was not told about — would otherwise quietly
 * start recording zero, and the first sign of trouble would be the bill. An
 * unpriced call records its tokens with a null cost and says so in the log.
 */

/**
 * Where the spend goes, in categories somebody can act on.
 *
 * These are deliberately about the product rather than the plumbing: knowing
 * that half the money goes on reading uploaded documents tells you to reach
 * for a cheaper model there, and knowing it goes on "the chat endpoint" tells
 * you nothing.
 */
export type Feature =
  | "voice_conversation"
  | "agent_chat"
  | "resume_extraction"
  | "document_read"
  | "ats_analysis"
  | "resume_generation"
  | "resume_rewrite";

/** Who and what a call belongs to. Required, so a call cannot go unattributed. */
export type UsageMeta = {
  feature: Feature;
  userId?: string | null;
  /** The conversation, or the live session. */
  sessionId?: string | null;
};

/** What a provider tells us it used. Absent fields stay absent, never zero. */
export type TokenUsage = {
  input?: number;
  output?: number;
  /** Realtime bills audio separately and far higher than text. */
  audioInput?: number;
  audioOutput?: number;
};

/* ------------------------------------------------------------------ rates */

type Rate = {
  /** USD per million tokens. */
  input: number;
  output: number;
  audioInput?: number;
  audioOutput?: number;
};

/**
 * USD per million tokens, read from OpenAI's pricing page on 2 September 2026.
 *
 * Matched by prefix, longest first, so `gpt-5.6-luna-2026-08-01` finds the
 * `gpt-5.6-luna` rate without this table needing a row per dated snapshot.
 *
 * When a price changes, change it here and nowhere else. Rows already written
 * keep the number they were written with, which is the point.
 */
const RATES: Record<string, Rate> = {
  "gpt-5.6-sol": { input: 4.0, output: 20.0 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-4o-mini-transcribe": { input: 1.25, output: 5.0 },
  "gpt-realtime": { input: 4.0, output: 24.0, audioInput: 32.0, audioOutput: 64.0 },
};

/** Names we have already complained about, so a busy day logs once each. */
const unpriced = new Set<string>();

export function rateFor(model: string): Rate | null {
  const name = model.trim().toLowerCase();

  // Longest prefix wins: "gpt-realtime-2.1" must not match a shorter row that
  // happens to also be a prefix of it.
  const key = Object.keys(RATES)
    .filter((k) => name.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];

  if (key) return RATES[key];

  if (!unpriced.has(name)) {
    unpriced.add(name);
    console.warn(
      `ai-cost: no rate for "${model}". Tokens are still recorded; cost will be null. ` +
        `Add it to RATES in lib/app/ai-cost.ts.`,
    );
  }
  return null;
}

/**
 * What this call cost, in USD, or null if we cannot say honestly.
 *
 * Null rather than zero, everywhere. A zero in this column would mean "this
 * call was free", and none of them are.
 */
export function costOf(model: string, usage: TokenUsage): number | null {
  const rate = rateFor(model);
  if (!rate) return null;

  const per = (tokens: number | undefined, usdPerMillion: number | undefined) =>
    tokens && usdPerMillion ? (tokens / 1_000_000) * usdPerMillion : 0;

  const total =
    per(usage.input, rate.input) +
    per(usage.output, rate.output) +
    per(usage.audioInput, rate.audioInput) +
    per(usage.audioOutput, rate.audioOutput);

  // Six decimal places, which is what the column holds. A call costing less
  // than a ten-thousandth of a cent rounds to zero, and that is fine — it is
  // rounding, not a claim that the call was free.
  return Math.round(total * 1_000_000) / 1_000_000;
}

/* ---------------------------------------------------------------- reading */

/**
 * Pull the token counts out of whatever the provider sent back.
 *
 * The two providers spell this differently and neither is stable across
 * versions, so every field is looked for by name and nothing is assumed. A
 * response with no usage block returns an empty object rather than zeros —
 * "we do not know" and "it used nothing" are different facts and only one of
 * them is ever true.
 */
export function readUsage(json: unknown): TokenUsage {
  if (!json || typeof json !== "object") return {};
  const body = json as Record<string, unknown>;

  const block =
    (body.usage as Record<string, unknown> | undefined) ??
    (body.usageMetadata as Record<string, unknown> | undefined);
  if (!block || typeof block !== "object") return {};

  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined;

  // OpenAI Responses: input_tokens / output_tokens.
  // Gemini: promptTokenCount / candidatesTokenCount.
  const input = num(block.input_tokens) ?? num(block.promptTokenCount);
  const output = num(block.output_tokens) ?? num(block.candidatesTokenCount);

  // Realtime reports a per-modality breakdown; audio is the expensive half and
  // billing it as text would understate a call eightfold.
  const details = block.input_token_details as Record<string, unknown> | undefined;
  const outDetails = block.output_token_details as Record<string, unknown> | undefined;
  const audioInput = num(details?.audio_tokens);
  const audioOutput = num(outDetails?.audio_tokens);

  return {
    // The totals include the audio tokens, so the text half is what is left.
    ...(input !== undefined ? { input: audioInput ? Math.max(0, input - audioInput) : input } : {}),
    ...(output !== undefined
      ? { output: audioOutput ? Math.max(0, output - audioOutput) : output }
      : {}),
    ...(audioInput ? { audioInput } : {}),
    ...(audioOutput ? { audioOutput } : {}),
  };
}
