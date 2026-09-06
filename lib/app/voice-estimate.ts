import { rateFor, type Rate } from "@/lib/app/ai-cost";

/**
 * What a minute of talking to the agent costs, before anybody has talked.
 *
 * The dashboard answers "what did we spend". This answers the question you
 * actually need before you price a plan: **if a person talks to the agent for
 * ten minutes, what does that cost me** — on the models currently selected,
 * not on the models that happened to run last month.
 *
 * ------------------------------------------------------- why it is not flat
 *
 * The obvious version multiplies a per-minute rate by minutes and is wrong,
 * because a realtime session does not bill like a phone call. Two things make
 * minute ten dearer than minute one:
 *
 *   1. **The whole conversation is re-sent on every response.** Not a summary —
 *      the accumulated audio and text, every time the agent answers. So input
 *      grows with the square of the call length, not linearly.
 *
 *   2. **Most of that re-sent context is cached**, and cached input is priced
 *      around eighty times lower than fresh audio. Which of those two rates
 *      you apply changes the answer by two orders of magnitude, so an
 *      estimator that ignores caching is not conservative — it is useless.
 *
 * So this models a whole call and divides, and reports the per-minute figure
 * as an average over a call of that length. A ten-minute call does not cost
 * ten times a one-minute call, and saying so is the point.
 *
 * ------------------------------------------------------------ the honesty
 *
 * Every assumption is a named constant with a reason, exported so the screen
 * can print them next to the number. An estimate whose assumptions are hidden
 * is a number people quote in meetings without knowing what it rests on — and
 * this codebase has already been bitten twice by confident numbers.
 *
 * These are estimates and are never written to `ai_usage`. That column holds
 * what the provider charged; this holds what we think it will.
 *
 * Token rates from developers.openai.com/api/docs/guides/realtime-costs,
 * read 6 September 2026: user audio is billed at one token per 100ms and
 * assistant audio at one token per 50ms.
 */

/* ------------------------------------------------------ physical constants */

/** User audio: 1 token per 100 ms. */
export const AUDIO_IN_TOKENS_PER_MIN = 600;

/** Assistant audio: 1 token per 50 ms — twice the rate, and twice the price. */
export const AUDIO_OUT_TOKENS_PER_MIN = 1_200;

/**
 * The system instruction, tool schemas and grounding sent with the session.
 *
 * Measured rather than guessed: this is roughly what `instructions.ts` plus
 * the tool definitions come to. It is charged once as fresh input and then
 * lives in the cached prefix for the rest of the call, which is exactly why it
 * matters much less than its size suggests.
 */
export const SYSTEM_TOKENS = 2_400;

/** A spoken word is about this many tokens once transcribed. */
export const TOKENS_PER_WORD = 1.35;

/* --------------------------------------------------------------- profiles */

export type Profile = {
  key: "heavy" | "normal" | "light";
  label: string;
  /** What this person is like, in one line, for the screen. */
  note: string;
  /** How long their call runs. The single biggest driver of cost. */
  minutes: number;
  /**
   * Share of the call the agent is speaking.
   *
   * Assistant audio is the most expensive token in the product, so this is the
   * number to argue about. A person who interrupts constantly is *cheaper*
   * than one who lets the agent finish, which is unintuitive and true.
   */
  agentTalkShare: number;
  /** Words the person says per minute while they are speaking. */
  wordsPerMinute: number;
  /** Share of the call the person is speaking. */
  userTalkShare: number;
  /** Model responses per minute — each one re-sends the conversation. */
  turnsPerMinute: number;
  /**
   * Text-model calls this conversation triggers on top of the voice session:
   * reading an upload, writing the résumé, rewriting a section. Counted
   * against the models chosen for those features, not against the voice model.
   */
  textCalls: { feature: TextFeature; count: number }[];
};

export type TextFeature =
  | "agent_chat"
  | "resume_extraction"
  | "document_read"
  | "ats_analysis"
  | "resume_generation"
  | "resume_rewrite";

/**
 * Roughly what each of these calls costs in tokens, per call.
 *
 * Input dominates by a long way — the résumé, the grounding and the
 * conversation so far all go up with every request, while the reply is a few
 * hundred tokens. That 97:3 split is measured from `ai_usage`, not assumed.
 */
export const TEXT_CALL_TOKENS: Record<TextFeature, { input: number; output: number }> = {
  agent_chat: { input: 6_000, output: 350 },
  resume_extraction: { input: 9_000, output: 1_800 },
  document_read: { input: 12_000, output: 1_200 },
  ats_analysis: { input: 7_000, output: 900 },
  resume_generation: { input: 8_000, output: 2_400 },
  resume_rewrite: { input: 5_000, output: 400 },
};

/**
 * Three people, described as behaviour rather than as tiers.
 *
 * The numbers are deliberately conservative-but-not-silly: a "heavy" user is
 * somebody who really uses the product for twenty minutes, not a stress test.
 * Replace them the moment real sessions give better ones — `ai_usage` now
 * records the tokens that would settle every one of these.
 */
export const PROFILES: Profile[] = [
  {
    key: "heavy",
    label: "Power user",
    note: "Works through the whole résumé out loud. Long call, many turns, uploads a file and has sections rewritten.",
    minutes: 20,
    agentTalkShare: 0.45,
    userTalkShare: 0.35,
    wordsPerMinute: 150,
    turnsPerMinute: 4,
    textCalls: [
      { feature: "resume_extraction", count: 1 },
      { feature: "document_read", count: 1 },
      { feature: "resume_generation", count: 1 },
      { feature: "resume_rewrite", count: 6 },
      { feature: "agent_chat", count: 4 },
    ],
  },
  {
    key: "normal",
    label: "Normal user",
    note: "Talks through the main sections, gets a résumé out of it, a couple of edits.",
    minutes: 8,
    agentTalkShare: 0.45,
    userTalkShare: 0.3,
    wordsPerMinute: 140,
    turnsPerMinute: 3.5,
    textCalls: [
      { feature: "resume_extraction", count: 1 },
      { feature: "resume_generation", count: 1 },
      { feature: "resume_rewrite", count: 2 },
    ],
  },
  {
    key: "light",
    label: "Light user",
    note: "Tries it, asks a couple of things, mostly listens, and leaves without finishing.",
    minutes: 3,
    agentTalkShare: 0.5,
    userTalkShare: 0.2,
    wordsPerMinute: 120,
    turnsPerMinute: 3,
    textCalls: [{ feature: "agent_chat", count: 1 }],
  },
];

/* ------------------------------------------------------------ the estimate */

export type Estimate = {
  profile: Profile;
  /** Null when a chosen model has no rate — say so rather than show a number. */
  usd: number | null;
  perMinuteUsd: number | null;
  /** Which models could not be priced, so the screen can name them. */
  unpriced: string[];
  /**
   * The split, so somebody can see where the money actually goes.
   *
   * `key` is what a colour binds to. Sorting these by size and colouring by
   * position would mean the same hue meant "speaking" in one row and "re-sent
   * context" in the next — colour has to follow the thing, never its rank.
   * Fixed order for the same reason: segments in a different sequence per row
   * cannot be compared across rows by eye.
   */
  parts: { key: PartKey; label: string; usd: number }[];
  tokens: {
    audioIn: number;
    audioOut: number;
    textIn: number;
    textOut: number;
    /** Re-sent conversation, billed at the cached rate. */
    cachedIn: number;
  };
};

/** Which model answers each feature, as the settings screen has it. */
export type PartKey = "audioOut" | "audioIn" | "cached" | "transcripts" | "textCalls";

/** Fixed presentation order, independent of which happens to be largest. */
export const PART_ORDER: PartKey[] = ["audioOut", "audioIn", "cached", "transcripts", "textCalls"];

export type Chosen = { voice: string | null; text: Partial<Record<TextFeature, string | null>> };

function usdRate(rate: Rate | null, field: keyof Rate, inrPerUsd: number): number | null {
  const value = rate?.[field];
  if (typeof value !== "number") return null;
  return rate?.currency === "INR" ? value / inrPerUsd : value;
}

/**
 * Cost a whole call, then divide.
 *
 * The re-sent context is the interesting term. At turn *k* the conversation so
 * far is re-sent; summing over the call gives roughly half the total tokens
 * multiplied by the number of turns, which is the quadratic growth the
 * per-minute figure would otherwise hide. It is billed at the cached rate,
 * because that is what the provider does with a stable prefix — and when a
 * model publishes no cached rate we refuse to guess and return null instead of
 * silently pricing that half at zero.
 */
export function estimate(profile: Profile, chosen: Chosen, inrPerUsd = 88): Estimate {
  const unpriced: string[] = [];
  const parts: Estimate["parts"] = [];

  const minutes = profile.minutes;

  /**
   * Input audio is the whole call, not only the part they were talking.
   *
   * The microphone streams continuously while the session is open, so the
   * provider is tokenising silence at the same rate as speech. Modelling this
   * as `userTalkShare × minutes` would undercount a real bill by roughly a
   * third, and it is the sort of undercount that only shows up on the invoice.
   */
  const audioIn = Math.round(AUDIO_IN_TOKENS_PER_MIN * minutes);
  const audioOut = Math.round(AUDIO_OUT_TOKENS_PER_MIN * minutes * profile.agentTalkShare);

  // Transcripts of both sides, which are billed as text on top of the audio.
  const spokenWords = profile.wordsPerMinute * minutes * profile.userTalkShare;
  const textIn = Math.round(SYSTEM_TOKENS + spokenWords * TOKENS_PER_WORD);
  const textOut = Math.round(audioOut / 8);

  const turns = Math.max(1, Math.round(profile.turnsPerMinute * minutes));
  // Everything that exists to be re-sent, averaged over the call, times the
  // number of times it gets re-sent.
  const cachedIn = Math.round(((audioIn + textIn + audioOut) / 2) * turns);

  const voiceRate = chosen.voice ? rateFor(chosen.voice) : null;
  if (chosen.voice && !voiceRate) unpriced.push(chosen.voice);

  const audioInRate = usdRate(voiceRate, "audioInput", inrPerUsd);
  const audioOutRate = usdRate(voiceRate, "audioOutput", inrPerUsd);
  const inRate = usdRate(voiceRate, "input", inrPerUsd);
  const outRate = usdRate(voiceRate, "output", inrPerUsd);
  const cachedRate = usdRate(voiceRate, "cachedInput", inrPerUsd);

  let voiceUsd: number | null = null;
  if (
    audioInRate !== null &&
    audioOutRate !== null &&
    inRate !== null &&
    outRate !== null &&
    cachedRate !== null
  ) {
    const M = 1_000_000;
    const heard = (audioIn / M) * audioInRate;
    const spoke = (audioOut / M) * audioOutRate;
    const read = (textIn / M) * inRate + (textOut / M) * outRate;
    const resent = (cachedIn / M) * cachedRate;
    voiceUsd = heard + spoke + read + resent;

    parts.push(
      { key: "audioOut", label: "Speaking (audio out)", usd: spoke },
      { key: "audioIn", label: "Listening (audio in)", usd: heard },
      { key: "cached", label: "Re-sent conversation (cached)", usd: resent },
      { key: "transcripts", label: "Transcripts and instructions", usd: read },
    );
  } else if (chosen.voice && voiceRate && !unpriced.includes(chosen.voice)) {
    // Priced, but not for every part a spoken call uses — most often a missing
    // cached rate. Naming it is more useful than halving the answer.
    unpriced.push(chosen.voice);
  }

  // The text features this conversation also triggers, on their own models.
  let textUsd = 0;
  let textPriced = true;
  for (const { feature, count } of profile.textCalls) {
    const model = chosen.text[feature];
    if (!model) continue;
    const rate = rateFor(model);
    const i = usdRate(rate, "input", inrPerUsd);
    const o = usdRate(rate, "output", inrPerUsd);
    if (i === null || o === null) {
      if (!unpriced.includes(model)) unpriced.push(model);
      textPriced = false;
      continue;
    }
    const size = TEXT_CALL_TOKENS[feature];
    textUsd += count * ((size.input / 1_000_000) * i + (size.output / 1_000_000) * o);
  }
  if (textUsd > 0) parts.push({ key: "textCalls", label: "Résumé and text calls", usd: textUsd });

  const usd = voiceUsd === null ? null : textPriced ? voiceUsd + textUsd : null;

  return {
    profile,
    usd,
    perMinuteUsd: usd === null ? null : usd / minutes,
    unpriced,
    // Fixed order, not biggest-first. See the note on `parts`.
    parts: parts.sort((a, b) => PART_ORDER.indexOf(a.key) - PART_ORDER.indexOf(b.key)),
    tokens: { audioIn, audioOut, textIn, textOut, cachedIn },
  };
}

/** Every profile at once, which is what the screen shows. */
export function estimateAll(chosen: Chosen, inrPerUsd = 88): Estimate[] {
  return PROFILES.map((p) => estimate(p, chosen, inrPerUsd));
}
