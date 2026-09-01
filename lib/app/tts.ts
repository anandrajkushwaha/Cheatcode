import "server-only";
import { createHash } from "node:crypto";

/**
 * The agent's actual voice.
 *
 * The browser's speechSynthesis got us this far and it sounds like 2011 — flat,
 * robotic, and different on every machine, which for a product whose whole
 * first impression is a voice is not a small thing. ElevenLabs is the voice
 * people mean when they say a product "sounds good".
 *
 * Flash rather than the expressive models, because this is a greeting: it has
 * to land in the moment the screen opens, and a quarter of a second of extra
 * latency is worth more than a shade more emotion in a sentence nobody is
 * listening to closely.
 *
 * The key never leaves the server. A key in a browser is a key on the
 * internet, and this one is billed per character.
 */

const API = process.env.ELEVENLABS_API_BASE ?? "https://api.elevenlabs.io/v1";
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_flash_v2_5";

/** mp3 at 44.1kHz/64kbps: half the bytes of the default, and speech at this bitrate is indistinguishable. */
const FORMAT = "mp3_44100_64";

/** A greeting, not an essay. Anything longer is a bug or an attack. */
export const MAX_CHARS = 600;

/**
 * Same words, same audio.
 *
 * Every character is billed, and the greeting one person hears is byte for
 * byte the greeting they hear tomorrow. Without this, opening the agent five
 * times in a day is five times the bill for one sentence.
 *
 * Per instance and in memory, so it is lost on a cold start — which is the
 * honest limit of caching without a store, and still removes most of the
 * repeats, because the repeats happen within a session.
 */
const cache = new Map<string, ArrayBuffer>();
const MAX_CACHED = 200;

/** Discovered once, like the Gemini model, for exactly the same reason. */
let resolvedVoice: string | null = null;

export type Speech =
  | { ok: true; audio: ArrayBuffer; cached: boolean }
  | { ok: false; error: string; status: number };

export function ttsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

/**
 * Which voice.
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
    const res = await fetch(`${API}/voices`, {
      headers: { "xi-api-key": key },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // This used to return null in silence, which produced a 502 with no
      // explanation anywhere — the single most useless failure a server can
      // have. 401 is the key, 403 is usually a plan that cannot list voices.
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

export async function speak(text: string): Promise<Speech> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { ok: false, error: "Voice isn't configured.", status: 503 };

  const clean = text.trim().slice(0, MAX_CHARS);
  if (!clean) return { ok: false, error: "Nothing to say.", status: 400 };

  const voice = await voiceId(key);
  if (!voice) {
    console.error("tts: no voice id — see the line above for why");
    return { ok: false, error: "No voice available on this account.", status: 502 };
  }

  const id = createHash("sha256").update(`${voice}:${MODEL}:${clean}`).digest("hex");
  const hit = cache.get(id);
  if (hit) return { ok: true, audio: hit, cached: true };

  let res: Response;
  try {
    res = await fetch(`${API}/text-to-speech/${voice}?output_format=${FORMAT}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: clean,
        model_id: MODEL,
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
    });
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

  const audio = await res.arrayBuffer();

  if (cache.size >= MAX_CACHED) {
    // Oldest first. A Map iterates in insertion order, so this is enough of an
    // eviction policy for a bounded set of greetings.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(id, audio);

  return { ok: true, audio, cached: false };
}
