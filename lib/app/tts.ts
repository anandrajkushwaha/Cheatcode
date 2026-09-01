import "server-only";
import { createHash } from "node:crypto";

/**
 * The agent's actual voice, for anything that is spoken but not a conversation
 * — the greeting, mostly.
 *
 * The browser's own speechSynthesis got us this far and it sounds like 2011:
 * flat, robotic, and different on every machine, which for a product whose
 * first impression is a voice is not a small thing.
 *
 * Two providers, in this order:
 *
 *   OpenAI       when OPENAI_API_KEY is set. One key for the agent, the live
 *                conversation and this, which is the whole reason it is first.
 *   ElevenLabs   otherwise, or when TTS_PROVIDER says so explicitly.
 *
 * One thing is genuinely worse on OpenAI and it is worth being honest about:
 * its voices are built for English and none of them is Indian-accented, where
 * ElevenLabs had one and it was chosen deliberately — a British newsreader
 * saying "lakh" is a small, constant reminder that this was not built for the
 * person listening. The `instructions` field claws some of that back, and
 * TTS_PROVIDER=elevenlabs gets the accent back entirely.
 *
 * Keys never leave the server. A key in a browser is a key on the internet,
 * and both of these are billed per character.
 */

const OPENAI_BASE = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";
const ELEVEN_BASE = process.env.ELEVENLABS_API_BASE ?? "https://api.elevenlabs.io/v1";

/**
 * gpt-4o-mini-tts rather than tts-1: it is the only one that takes
 * `instructions`, and steering the delivery is doing real work here.
 */
const OPENAI_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";

/**
 * marin is one of the two OpenAI recommends for quality. Overridable, because
 * which voice a product should have is a taste decision, not a code one.
 */
const OPENAI_VOICE = process.env.OPENAI_TTS_VOICE ?? "marin";

/**
 * What we cannot fix with an accent, we can fix with delivery.
 *
 * The audience is Indian job seekers, and the two things that give an English
 * voice away are galloping through a sentence and saying "lakh" and "crore"
 * as if they were foreign words. This is cheap and it measurably helps.
 */
const OPENAI_STYLE =
  process.env.OPENAI_TTS_INSTRUCTIONS ??
  "Speak Indian English, warm and unhurried, the way a good mentor talks to " +
    "someone they respect. Say Indian names, 'lakh' and 'crore' naturally, " +
    "not as foreign words. Calm and level — never chirpy, never salesy.";

/** Flash rather than the expressive models: this has to land the moment the screen opens. */
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5";

/** mp3 at 44.1kHz/64kbps: half the bytes of the default, and speech at this bitrate is indistinguishable. */
const ELEVEN_FORMAT = "mp3_44100_64";

/** A greeting, not an essay. Anything longer is a bug or an attack. */
export const MAX_CHARS = 600;

/**
 * Same words, same audio.
 *
 * Every character is billed, and the greeting one person hears is byte for
 * byte the greeting they hear tomorrow. Without this, opening the agent five
 * times in a day is five times the bill for one sentence.
 *
 * Per instance and in memory, so it is lost on a cold start — the honest limit
 * of caching without a store, and it still removes most of the repeats,
 * because the repeats happen within a session.
 */
const cache = new Map<string, ArrayBuffer>();
const MAX_CACHED = 200;

/** Discovered once, like the chat model, for exactly the same reason. */
let resolvedVoice: string | null = null;

export type Speech =
  | { ok: true; audio: ArrayBuffer; cached: boolean }
  | { ok: false; error: string; status: number };

export type TtsProvider = "openai" | "elevenlabs";

export function ttsProvider(): TtsProvider | null {
  const forced = process.env.TTS_PROVIDER?.trim().toLowerCase();
  if (forced === "openai") return process.env.OPENAI_API_KEY ? "openai" : null;
  if (forced === "elevenlabs") return process.env.ELEVENLABS_API_KEY ? "elevenlabs" : null;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  return null;
}

export function ttsConfigured(): boolean {
  return ttsProvider() !== null;
}

export async function speak(text: string): Promise<Speech> {
  const provider = ttsProvider();
  if (!provider) return { ok: false, error: "Voice isn't configured.", status: 503 };

  const clean = text.trim().slice(0, MAX_CHARS);
  if (!clean) return { ok: false, error: "Nothing to say.", status: 400 };

  return provider === "openai" ? speakOpenAI(clean) : speakElevenLabs(clean);
}

/* ---------------------------------------------------------------- openai */

async function speakOpenAI(clean: string): Promise<Speech> {
  const key = process.env.OPENAI_API_KEY!;

  const id = key256(`openai:${OPENAI_VOICE}:${OPENAI_MODEL}:${OPENAI_STYLE}:${clean}`);
  const hit = cache.get(id);
  if (hit) return { ok: true, audio: hit, cached: true };

  let res: Response;
  try {
    res = await fetch(`${OPENAI_BASE}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: clean,
        voice: OPENAI_VOICE,
        instructions: OPENAI_STYLE,
        // mp3 because the client hands the blob to an <audio> element, and
        // every browser plays mp3 without being asked twice.
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    console.error("tts: could not reach OpenAI —", String(e).slice(0, 200));
    return { ok: false, error: "Could not reach the voice service.", status: 502 };
  }

  if (!res.ok) {
    // This whole family of failures once returned null in silence and produced
    // a 502 with no explanation anywhere — the single most useless failure a
    // server can have. 401 is the key, 400 is usually a bad voice or model
    // name, 429 is quota.
    const body = await res.text().catch(() => "");
    console.error(
      "tts: openai returned",
      res.status,
      body.slice(0, 400),
      res.status === 401 ? "— check OPENAI_API_KEY" : "",
      res.status === 400 ? `— voice "${OPENAI_VOICE}", model "${OPENAI_MODEL}"` : "",
    );
    return {
      ok: false,
      error: res.status === 429 ? "Voice quota reached." : "The voice service refused that.",
      status: 502,
    };
  }

  return keep(id, await res.arrayBuffer());
}

/* ----------------------------------------------------------- elevenlabs */

async function speakElevenLabs(clean: string): Promise<Speech> {
  const key = process.env.ELEVENLABS_API_KEY!;

  const voice = await voiceId(key);
  if (!voice) {
    console.error("tts: no voice id — see the line above for why");
    return { ok: false, error: "No voice available on this account.", status: 502 };
  }

  const id = key256(`eleven:${voice}:${ELEVEN_MODEL}:${clean}`);
  const hit = cache.get(id);
  if (hit) return { ok: true, audio: hit, cached: true };

  let res: Response;
  try {
    res = await fetch(
      `${ELEVEN_BASE}/text-to-speech/${voice}?output_format=${ELEVEN_FORMAT}`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean,
          model_id: ELEVEN_MODEL,
          voice_settings: {
            // Steady rather than theatrical. This voice says the same greeting
            // every day; a delivery that varies run to run reads as unstable
            // rather than as alive.
            stability: 0.55,
            similarity_boost: 0.75,
            speed: 0.98,
          },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    return { ok: false, error: "Could not reach the voice service.", status: 502 };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("tts: elevenlabs returned", res.status, body.slice(0, 400));
    // 401 is the key, 422 is usually a dead voice id, 429 is the character
    // quota. All three are ours to fix, and none is worth a stack trace in
    // front of somebody who just wanted to be greeted.
    return {
      ok: false,
      error: res.status === 429 ? "Voice quota reached." : "The voice service refused that.",
      status: 502,
    };
  }

  return keep(id, await res.arrayBuffer());
}

/**
 * Which ElevenLabs voice.
 *
 * Set ELEVENLABS_VOICE_ID and that is used, full stop. Leave it unset and the
 * account is asked what it has — because a voice ID copied from documentation
 * is a 404 waiting to happen on somebody else's account, which is a mistake
 * this codebase has already made twice with model names.
 */
async function voiceId(key: string): Promise<string | null> {
  const pinned = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (pinned) return pinned;
  if (resolvedVoice) return resolvedVoice;

  try {
    const res = await fetch(`${ELEVEN_BASE}/voices`, {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `tts: listing voices failed with ${res.status}`,
        body.slice(0, 300),
        res.status === 401 ? "— check ELEVENLABS_API_KEY" : "",
      );
      return null;
    }

    const json = (await res.json()) as {
      voices?: { voice_id?: string; name?: string; labels?: Record<string, string> }[];
    };
    const voices = (json.voices ?? []).filter((v) => v.voice_id);
    if (!voices.length) {
      console.error("tts: the account has no voices at all");
      return null;
    }

    // Prefer an Indian-accented voice when the account has one — the audience
    // is Indian and a British newsreader reading out "lakh" is a small,
    // constant reminder that this was not built for them.
    const indian = voices.find((v) =>
      Object.values(v.labels ?? {}).some((l) => /indian|india/i.test(l)),
    );

    const chosen = (indian ?? voices[0]).voice_id!;
    console.info(
      `tts: using voice ${(indian ?? voices[0]).name ?? chosen}` +
        `${indian ? " (Indian accent)" : ""}, chosen from ${voices.length}`,
    );
    resolvedVoice = chosen;
    return chosen;
  } catch (e) {
    console.error("tts: could not reach ElevenLabs to list voices —", String(e).slice(0, 200));
    return null;
  }
}

/* --------------------------------------------------------------- shared */

const key256 = (s: string) => createHash("sha256").update(s).digest("hex");

function keep(id: string, audio: ArrayBuffer): Speech {
  if (cache.size >= MAX_CACHED) {
    // Oldest first. A Map iterates in insertion order, so this is enough of an
    // eviction policy for a bounded set of greetings.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(id, audio);
  return { ok: true, audio, cached: false };
}
