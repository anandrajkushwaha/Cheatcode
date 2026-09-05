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
  /** Per million tokens, in `currency`. */
  input: number;
  output: number;
  audioInput?: number;
  audioOutput?: number;
  /** Defaults to USD. Sarvam publishes its rate card in rupees. */
  currency?: "USD" | "INR";
};

/**
 * One number, one place, and a date on it.
 *
 * Sarvam bills in rupees and every other provider in dollars, so something has
 * to reconcile them or `sum(cost_usd)` silently adds two different units
 * together and reports a number nobody can act on.
 *
 * Converting at write time rather than storing mixed currencies is the
 * deliberate choice: the alternative is a currency column, a second money
 * column, and every query having to know about both — real accounting
 * machinery for a table whose only job is "roughly, where is the money going".
 * The cost of this choice is that a row is only as accurate as this constant
 * was on the day it was written, which is why it is written down with a date
 * rather than hidden in an expression.
 *
 * Worth revisiting if the rupee moves more than a few percent, or the moment
 * anybody wants to reconcile this against an actual invoice.
 */
const INR_PER_USD = 88;

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

  // Gemini, read from ai.google.dev/gemini-api/docs/pricing on 2 Sep 2026.
  // The live model is the reason to have it: its audio is roughly a fifth of
  // what the OpenAI realtime session costs.
  "gemini-3.1-flash-live": { input: 3.0, output: 12.0, audioInput: 3.0, audioOutput: 12.0 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.7-flash": { input: 0.75, output: 3.75 },

  /**
   * Sarvam, in rupees, from the model catalogue on indus.sarvam.ai —
   * 5 September 2026, and deliberately NOT from the docs pricing page.
   *
   * The two sources disagree by seven times. The docs say ₹4 in and ₹16 out;
   * the console says ₹29.28 in. The console wins, and not because a dashboard
   * outranks a document — because the first real day of spend settles it:
   * 45.6K tokens billed ₹1.46, a blended ₹32.02 per million. At ₹4 that same
   * traffic would have cost about ₹0.20. At ₹29.28 in and ₹117.12 out, with
   * the roughly 97:3 input-to-output split that a large system prompt and
   * short replies produce, it comes to ₹31.9 per million. That is the bill.
   *
   * The input figure is measured. The output figure is inferred — it keeps
   * the docs' 1:4 in-to-out ratio applied to the console's input price, which
   * is what makes the arithmetic above land. Replace it the moment a
   * published number appears; a usage CSV with input and output split into
   * separate columns would settle it in one line.
   *
   * Worth remembering how wrong this was. Every Sarvam call so far was
   * recorded at a seventh of its true cost, in the one column built precisely
   * so nobody would have to guess. A confidently wrong number is worse than a
   * missing one, because nobody goes looking for it.
   */
  "sarvam-105b-conversations": { input: 29.28, output: 117.12, currency: "INR" },
  "sarvam-105b": { input: 29.28, output: 117.12, currency: "INR" },
  // Scaled by the same 7.32x the 105B row was out by. Nothing here uses 30B,
  // so this has never been checked against a bill — treat it as a placeholder
  // that is at least the right order of magnitude, not as a price.
  "sarvam-30b": { input: 18.3, output: 73.2, currency: "INR" },

  // The open-weight models Sarvam serves on /v2, same page and date. These are
  // an order of magnitude dearer than Sarvam's own, which is worth knowing:
  // one of them reads scanned resumes, because the flagship cannot see.
  "gemma-4-31b": { input: 36.6, output: 91.5, currency: "INR" },
  "deepseek-v4-flash": { input: 19.8, output: 59.4, currency: "INR" },
  "glm-5.2": { input: 128.1, output: 402.6, currency: "INR" },
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

  const per = (tokens: number | undefined, perMillion: number | undefined) =>
    tokens && perMillion ? (tokens / 1_000_000) * perMillion : 0;

  const native =
    per(usage.input, rate.input) +
    per(usage.output, rate.output) +
    per(usage.audioInput, rate.audioInput) +
    per(usage.audioOutput, rate.audioOutput);

  // Everything is stored in dollars so one query can add the whole table up.
  const total = rate.currency === "INR" ? native / INR_PER_USD : native;

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

  // Three providers, three spellings for the same two numbers.
  //   OpenAI Responses:  input_tokens     / output_tokens
  //   Gemini:            promptTokenCount / candidatesTokenCount
  //   Chat completions:  prompt_tokens    / completion_tokens   (Sarvam)
  const input = num(block.input_tokens) ?? num(block.promptTokenCount) ?? num(block.prompt_tokens);
  const output =
    num(block.output_tokens) ?? num(block.candidatesTokenCount) ?? num(block.completion_tokens);

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
