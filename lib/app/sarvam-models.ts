/**
 * Which Sarvam model answers, and where it lives.
 *
 * Smaller than its OpenAI and Gemini counterparts because Sarvam publishes a
 * stable, short list of model names. The other two registries exist mostly to
 * survive a name being renamed or retired underneath us — they guess, get a
 * 404, list what the key can actually reach, and pick again. There is no
 * equivalent listing endpoint documented here, so a wrong name is a wrong name
 * and says so, which is the honest failure.
 *
 * Two endpoints, and the difference matters. Sarvam's own models are served
 * from /v1 and are the ones tuned for Indian languages and code-mixed text —
 * which is the entire reason this provider is here, given who uses Cheatcode.
 * The open-weight models on /v2 are explicitly not tuned for that, so they are
 * reachable by configuration but never the default.
 */

const BASE = process.env.SARVAM_API_BASE ?? "https://api.sarvam.ai";

export type Kind = "chat";

/**
 * The flagship. 128K of context and tuned for 23 Indian languages, which is
 * what a career agent talking Hinglish to somebody in Pune actually needs —
 * a cheaper model that mangles code-mixed input is not cheaper.
 */
const DEFAULT_MODEL = "sarvam-105b";

/**
 * Models served from /v2 rather than /v1.
 *
 * Matched by prefix so a dated variant lands on the right endpoint. Getting
 * this wrong is a 404 that looks like a bad key, so it is a list rather than
 * a guess.
 */
const OPEN_WEIGHT = ["glm", "gemma", "deepseek"];

export function pinnedSarvam(): string | null {
  return process.env.SARVAM_CHAT_MODEL?.trim() || null;
}

export function preferredSarvamModel(): string {
  return pinnedSarvam() ?? DEFAULT_MODEL;
}

/** Sarvam's own models are on /v1; the open-weight ones are on /v2. */
export function sarvamChatUrl(model: string): string {
  const version = OPEN_WEIGHT.some((p) => model.toLowerCase().startsWith(p)) ? "v2" : "v1";
  return `${BASE}/${version}/chat/completions`;
}

/**
 * Both headers, deliberately.
 *
 * Sarvam's own documented header is `api-subscription-key`; it additionally
 * accepts a bearer token for OpenAI-shaped tooling. Sending both costs one
 * line and removes a whole class of "works in curl, 401s from the app".
 */
export function sarvamHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "api-subscription-key": key,
    Authorization: `Bearer ${key}`,
  };
}

/**
 * There is no model-listing endpoint to discover from.
 *
 * Returning null rather than throwing keeps the shape the other two providers
 * have: the caller keeps whatever model it had and reports the upstream's own
 * words, instead of pretending a retry might fix a name that is simply wrong.
 */
export async function discoverSarvamModel(): Promise<string | null> {
  return null;
}
