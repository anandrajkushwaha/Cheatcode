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
/**
 * Every kind of model call the product makes, in product terms.
 *
 * A list rather than a bare union, because three separate screens need to
 * iterate it — the spend breakdown, the settings page that assigns a model to
 * each one, and the flags gate that reads those assignments back. A union
 * cannot be iterated, and the alternative is the same seven strings written
 * out in three more places and drifting.
 */
export const FEATURES = [
  "voice_conversation",
  "agent_chat",
  "resume_extraction",
  "document_read",
  "ats_analysis",
  "resume_generation",
  "resume_rewrite",
] as const;

export type Feature = (typeof FEATURES)[number];

/** What each one is called on a screen a person reads. */
export const FEATURE_LABELS: Record<Feature, string> = {
  voice_conversation: "Voice conversation",
  agent_chat: "Agent chat",
  resume_extraction: "Reading an uploaded résumé",
  document_read: "Reading a document",
  ats_analysis: "ATS analysis",
  resume_generation: "Writing a résumé",
  resume_rewrite: "Rewriting a section",
};

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

export type Rate = {
  /** Per million tokens, in `currency`. Absent when the model bills by time. */
  input?: number;
  output?: number;
  audioInput?: number;
  audioOutput?: number;
  /**
   * Per minute of wall clock, for models that are not billed by token at all.
   *
   * `gpt-realtime-translate` and the transcription models are priced this way.
   * Costing them per token would produce a number with no relationship to the
   * invoice, which is worse than producing none.
   */
  perMinute?: number;
  /** Defaults to USD. Sarvam publishes its rate card in rupees. */
  currency?: "USD" | "INR";
  /**
   * Who serves this model. Stated, never inferred from the name.
   *
   * The catalogue used to work this out with `startsWith("gpt")`, which put
   * `chat-latest` — an OpenAI model — in the Sarvam group and priced it in
   * rupees on the settings screen. Same failure as the prefix-matched rates:
   * spelling is not a fact about billing. Absent on admin overrides, where it
   * would only be a second thing to keep in sync.
   */
  provider?: "openai" | "gemini" | "sarvam";
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
 * USD per million tokens. OpenAI and Gemini rows re-read from the published
 * pricing pages on 6 September 2026; see the sources at the bottom of this
 * comment block.
 *
 * ------------------------------------------------- how a name finds a rate
 *
 * **Exact match, or a dated snapshot of an exact match. Nothing else.**
 *
 * This used to be a longest-prefix match, and that was a real and expensive
 * mistake rather than a style choice. `gpt-realtime-2.1-mini` starts with
 * `gpt-realtime`, so it inherited the flagship's $32/$64 audio rate — the
 * mini actually bills $10/$20, so every mini call was recorded at over three
 * times its true cost. `gpt-realtime-translate` inherited it too, and that
 * model is not billed per token at all. Nine models in the picker, one price,
 * all of them confident and most of them wrong.
 *
 * A prefix is a fact about spelling, not about billing. The only safe
 * inheritance is a dated snapshot — `gpt-realtime-2.1-2026-06-03` genuinely is
 * `gpt-realtime-2.1` — so that is the only one this file does. Everything else
 * must be listed, aliased, or overridden in the admin screen. A model with no
 * rate records its tokens with a null cost and is counted as unpriced on the
 * dashboard, which is the honest answer and the one that gets noticed.
 *
 * Sources, 6 Sep 2026:
 *   developers.openai.com/api/docs/pricing
 *   ai.google.dev/gemini-api/docs/pricing
 */
const RATES: Record<string, Rate> = {
  // --- OpenAI chat
  "gpt-5.6-sol": { provider: "openai", input: 4.0, output: 20.0 },
  "gpt-5.6-terra": { provider: "openai", input: 2.0, output: 12.0 },
  "gpt-5.6-luna": { provider: "openai", input: 0.2, output: 1.2 },
  "gpt-6-astra": { provider: "openai", input: 10.0, output: 50.0 },
  "chat-latest": { provider: "openai", input: 5.0, output: 30.0 },

  /**
   * OpenAI realtime. Two priced models, and they are nothing like each other.
   *
   * The mini is 3.2x cheaper on audio in and 3.2x cheaper on audio out. Since
   * audio is where essentially all of a spoken session's money goes, that
   * difference is the entire economics of the voice feature — which is exactly
   * why pricing them identically was worth catching.
   */
  "gpt-realtime-2.1": { provider: "openai", input: 4.0, output: 24.0, audioInput: 32.0, audioOutput: 64.0 },
  "gpt-realtime-2.1-mini": { provider: "openai", input: 0.6, output: 2.4, audioInput: 10.0, audioOutput: 20.0 },

  /**
   * Billed by the minute, not by the token.
   *
   * `duration_seconds` is already recorded on every row, so these cost
   * correctly the moment they are named here. Left as a token rate they would
   * have produced a number that could never be reconciled against an invoice.
   */
  "gpt-realtime-translate": { provider: "openai", perMinute: 0.034 },
  "gpt-live-transcribe": { provider: "openai", perMinute: 0.017 },
  "gpt-realtime-whisper": { provider: "openai", perMinute: 0.017 },
  "gpt-transcribe": { provider: "openai", perMinute: 0.0045 },
  "gpt-4o-transcribe": { provider: "openai", input: 2.5, output: 10.0 },
  "gpt-4o-mini-transcribe": { provider: "openai", input: 1.25, output: 5.0 },

  // --- Gemini
  // The live model is the reason to have it: its audio is roughly a fifth of
  // what the OpenAI realtime session costs.
  "gemini-3.1-flash-live-preview": {
    provider: "gemini",
    input: 0.75,
    output: 4.5,
    audioInput: 3.0,
    audioOutput: 12.0,
  },
  "gemini-3.5-live-translate-preview": { provider: "gemini", audioInput: 3.5, audioOutput: 21.0 },
  "gemini-3.5-transcribe-live": { provider: "gemini", audioInput: 3.5, output: 21.0 },
  "gemini-3.1-flash-tts-preview": { provider: "gemini", input: 1.0, output: 20.0 },
  "gemini-3.5-flash": { provider: "gemini", input: 1.5, output: 9.0 },
  "gemini-3.5-flash-lite": { provider: "gemini", input: 0.3, output: 2.5 },
  // The page prices this one's *input* by modality — $0.25 text, $0.50 audio —
  // and does not state an output rate in a form worth copying. Input only, so
  // a call with output tokens comes out unpriced rather than under-counted.
  "gemini-3.1-flash-lite": { provider: "gemini", input: 0.25, audioInput: 0.5 },
  "gemini-3.1-pro-preview": { provider: "gemini", input: 2.0, output: 12.0 },
  "gemini-3.8-flash": { provider: "gemini", input: 0.75, output: 3.75 },
  "gemini-3.7-flash": { provider: "gemini", input: 0.75, output: 3.75 },

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
  "sarvam-105b-conversations": { provider: "sarvam", input: 29.28, output: 117.12, currency: "INR" },
  "sarvam-105b": { provider: "sarvam", input: 29.28, output: 117.12, currency: "INR" },
  // Scaled by the same 7.32x the 105B row was out by. Nothing here uses 30B,
  // so this has never been checked against a bill — treat it as a placeholder
  // that is at least the right order of magnitude, not as a price.
  "sarvam-30b": { provider: "sarvam", input: 18.3, output: 73.2, currency: "INR" },

  // The open-weight models Sarvam serves on /v2, same page and date. These are
  // an order of magnitude dearer than Sarvam's own, which is worth knowing:
  // one of them reads scanned resumes, because the flagship cannot see.
  "gemma-4-31b": { provider: "sarvam", input: 36.6, output: 91.5, currency: "INR" },
  "deepseek-v4-flash": { provider: "sarvam", input: 19.8, output: 59.4, currency: "INR" },
  "glm-5.2": { provider: "sarvam", input: 128.1, output: 402.6, currency: "INR" },
};

/**
 * The models a settings screen may offer, with who serves them.
 *
 * Derived from `RATES` rather than written twice, and that is the useful
 * constraint: **you cannot select a model we do not know how to price.** The
 * alternative — a free-text box — lets somebody point the agent at a model
 * that works fine and then reports every one of its calls as unpriced spend,
 * which is precisely the failure that made the Sarvam rate wrong for weeks.
 *
 * The provider is inferred from the name because that is how the rate table
 * is already organised, and a name that does not start with something we
 * recognise is left out rather than guessed at.
 */
export type CatalogueEntry = {
  model: string;
  provider: "openai" | "gemini" | "sarvam";
  /** Per million tokens, in the rate's own currency. For the screen's hint. */
  input: number;
  output: number;
  currency: "USD" | "INR";
  /** Realtime and live models bill audio too, which changes what they cost. */
  audio: boolean;
};

export function modelCatalogue(): CatalogueEntry[] {
  return Object.entries(RATES)
    .map(([model, rate]) => {
      const p = rate.provider ?? null;
      // A per-minute model has no per-token figure to show in a token-priced
      // list, so it is left out of the catalogue rather than shown as free.
      return p && rate.input !== undefined && rate.output !== undefined
        ? {
            model,
            provider: p,
            input: rate.input,
            output: rate.output,
            currency: (rate.currency ?? "USD") as "USD" | "INR",
            audio: rate.audioInput !== undefined,
          }
        : null;
    })
    .filter((e): e is CatalogueEntry => e !== null)
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model));
}

/**
 * Floating aliases, which are a name for "whatever is current".
 *
 * `gpt-realtime` is not a model; it is a pointer the provider re-aims when a
 * new generation ships. Following it here is a judgement, not a fact, so it
 * lives in its own table where it can be read as one — and every entry is
 * overridable from the admin screen the day a pointer moves.
 *
 * Older generations that are *not* aliases — `gpt-realtime-1.5`, `gpt-realtime-2`
 * — are deliberately absent. They are real, distinct models whose prices are no
 * longer published, and inventing a number for them is the mistake this whole
 * file was just rewritten to stop making.
 */
const ALIASES: Record<string, string> = {
  "gpt-realtime": "gpt-realtime-2.1",
  "gpt-realtime-mini": "gpt-realtime-2.1-mini",
};

/** A dated snapshot: `-2026-06-03` on the end of an otherwise known name. */
const SNAPSHOT = /-\d{4}-\d{2}-\d{2}$/;

/**
 * Prices set from the admin screen, which outrank this file.
 *
 * Pushed in by `lib/app/flags.ts` when it loads, rather than read from here,
 * so this module stays free of any server or database import — it is also
 * imported by a client component, and a `server-only` edge in this file would
 * be a build error rather than a helpful one.
 *
 * The point of these is not convenience. A rate table that only a deploy can
 * change is a table that is wrong for however long a deploy takes to arrange,
 * and this product has now been billed at the wrong rate twice while somebody
 * waited for exactly that.
 */
let OVERRIDES: Record<string, Rate> = {};

export function setRateOverrides(rates: Record<string, Rate>): void {
  OVERRIDES = rates;
  // A corrected rate should stop the "no rate" warning it was written for.
  unpriced.clear();
}

export function rateOverrides(): Record<string, Rate> {
  return OVERRIDES;
}

/** Names we have already complained about, so a busy day logs once each. */
const unpriced = new Set<string>();

/**
 * The rate for exactly this name, or for the model a dated snapshot is of.
 *
 * No prefix matching. See the note above `RATES` for what that cost.
 */
function look(table: Record<string, Rate>, name: string): Rate | null {
  if (table[name]) return table[name];
  const base = name.replace(SNAPSHOT, "");
  return base !== name && table[base] ? table[base] : null;
}

export function rateFor(model: string): Rate | null {
  const name = model.trim().toLowerCase();

  // An override is checked against the name as written *and* against what it
  // resolves to, so correcting "gpt-realtime-2.1" also corrects "gpt-realtime".
  const resolved = ALIASES[name] ?? ALIASES[name.replace(SNAPSHOT, "")] ?? name;

  const rate =
    look(OVERRIDES, name) ??
    look(OVERRIDES, resolved) ??
    look(RATES, name) ??
    look(RATES, resolved);

  if (rate) return rate;

  if (!unpriced.has(name)) {
    unpriced.add(name);
    console.warn(
      `ai-cost: no rate for "${model}". Tokens are still recorded; cost will be null. ` +
        `Set one on the admin Settings screen, or add it to RATES in lib/app/ai-cost.ts.`,
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
export function costOf(
  model: string,
  usage: TokenUsage,
  durationSeconds?: number | null,
): number | null {
  const rate = rateFor(model);
  if (!rate) return null;

  // Billed by wall clock. Tokens, if the provider even sent any, are not what
  // the invoice is computed from, so they are not what we compute from either.
  if (rate.perMinute !== undefined) {
    if (!durationSeconds || durationSeconds <= 0) return null;
    const byTime = (durationSeconds / 60) * rate.perMinute;
    return round(rate.currency === "INR" ? byTime / INR_PER_USD : byTime);
  }

  /**
   * A bucket we have tokens for but no rate for makes the whole call unpriced.
   *
   * The alternative is adding zero for that bucket, which reports a real cost
   * that is quietly too low — the single worst outcome for a column whose only
   * job is to be trusted. A partial rate is not a discount.
   */
  const missing =
    (usage.input && rate.input === undefined) ||
    (usage.output && rate.output === undefined) ||
    (usage.audioInput && rate.audioInput === undefined) ||
    (usage.audioOutput && rate.audioOutput === undefined);
  if (missing) {
    if (!unpriced.has(`partial:${model}`)) {
      unpriced.add(`partial:${model}`);
      console.warn(
        `ai-cost: "${model}" has a rate, but not for every token type this call used. ` +
          `Recording it as unpriced rather than under-counting it.`,
      );
    }
    return null;
  }

  const per = (tokens: number | undefined, perMillion: number | undefined) =>
    tokens && perMillion ? (tokens / 1_000_000) * perMillion : 0;

  const native =
    per(usage.input, rate.input) +
    per(usage.output, rate.output) +
    per(usage.audioInput, rate.audioInput) +
    per(usage.audioOutput, rate.audioOutput);

  // Everything is stored in dollars so one query can add the whole table up.
  return round(rate.currency === "INR" ? native / INR_PER_USD : native);
}

/**
 * Six decimal places, which is what the column holds.
 *
 * A call costing less than a ten-thousandth of a cent rounds to zero, and that
 * is fine — it is rounding, not a claim that the call was free.
 */
function round(usd: number): number {
  return Math.round(usd * 1_000_000) / 1_000_000;
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
