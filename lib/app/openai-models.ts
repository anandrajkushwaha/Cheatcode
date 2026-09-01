import "server-only";

/**
 * Which OpenAI model to use, decided by asking rather than by guessing.
 *
 * Same argument as gemini-models.ts, and it is worth restating because it was
 * learned the expensive way: a model name copied out of documentation is a
 * 404 waiting to happen, because which models a key can reach depends on the
 * key, the account tier and the week. Two rounds of this codebase were spent
 * on exactly that mistake.
 *
 * So the API is asked what it has, the best match is chosen, and the answer
 * is cached for the life of the process. `OPENAI_CHAT_MODEL` is honoured
 * without argument — an explicit choice that is wrong should fail loudly
 * rather than be quietly replaced with something else.
 */

const ENDPOINT = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";

/**
 * Two jobs, two model families, one key.
 *
 * `chat` answers a typed turn. `realtime` holds a spoken conversation over
 * WebRTC and is a completely separate set of model names — asking for a chat
 * model on a realtime session is a 400, not a slightly worse answer.
 */
export type Kind = "chat" | "realtime";

const cached = new Map<Kind, string>();

/**
 * What we reach for before asking.
 *
 * If this is not on the key, the first request 404s, discovery runs once and
 * the right name is used from then on — which costs one round trip on a cold
 * process and nothing after that.
 */
const FIRST_GUESS: Record<Kind, string> = {
  chat: "gpt-5",
  realtime: "gpt-realtime-2.1",
};

export function pinnedOpenAI(kind: Kind = "chat"): string | null {
  const value =
    kind === "chat" ? process.env.OPENAI_CHAT_MODEL : process.env.OPENAI_REALTIME_MODEL;
  return value?.trim() || null;
}

export function preferredOpenAIModel(kind: Kind = "chat"): string {
  return pinnedOpenAI(kind) ?? cached.get(kind) ?? FIRST_GUESS[kind];
}

export function rememberOpenAIModel(model: string, kind: Kind = "chat"): void {
  cached.set(kind, model);
}

/**
 * Ask the key what it can actually use.
 *
 * Returns null when the listing itself fails, so the caller keeps whatever it
 * had and reports honestly rather than pretending to have fixed something.
 */
export async function discoverOpenAIModel(
  key: string,
  /** Names already tried and found wanting, so a retry does not pick them again. */
  exclude: string[] = [],
  kind: Kind = "chat",
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) {
    console.error(
      `openai: listing models failed with ${res.status}`,
      (await res.text().catch(() => "")).slice(0, 300),
      res.status === 401 ? "— check OPENAI_API_KEY" : "",
    );
    return null;
  }

  const json = (await res.json().catch(() => null)) as { data?: { id?: string }[] } | null;
  const names = (json?.data ?? []).map((m) => m.id).filter((id): id is string => !!id);

  const best = names
    .filter((n) => !exclude.includes(n))
    .map((name) => ({ name, score: score(name, kind) }))
    .sort((a, b) => b.score - a.score)[0];

  if (best && best.score > 0) {
    console.info(`openai: using ${best.name} for ${kind}, chosen from ${names.length}`);
    rememberOpenAIModel(best.name, kind);
    return best.name;
  }

  console.error(`openai: no usable ${kind} model among ${names.length} available`);
  return null;
}

/**
 * The usable models on a list, best first.
 *
 * Exported for the diagnose route, so what it tests is what the app would
 * actually have picked rather than whatever happened to be first in the list.
 */
export function rankOpenAI(names: string[], kind: Kind = "chat"): string[] {
  return names
    .map((name) => ({ name, score: score(name, kind) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((c) => c.name);
}

/**
 * How much we want a given model for holding a conversation. Negative means never.
 *
 * The exclusions matter more than the preferences. An embedding, audio or
 * image model will not answer a chat turn at all, and picking one turns a
 * clear 404 into a confusing 400 that looks like our bug.
 */
function score(name: string, kind: Kind = "chat"): number {
  const n = name.toLowerCase();

  if (kind === "realtime") {
    // Realtime models are named for it, and they are the only ones that will
    // hold a WebRTC session at all. Everything else here is a 400 waiting to
    // happen, which reads as our bug rather than a wrong model name.
    if (!n.includes("realtime")) return -1;
    // A transcription-only or translation session is a different product with
    // a similar name, and neither of them talks back.
    if (/transcrib|translat/.test(n)) return -1;

    let r = 100;
    if (n.includes("mini")) r -= 10;
    if (n.includes("preview")) r -= 40;
    return r + trailingVersion(n) + dated(n);
  }

  if (
    /embedding|whisper|tts|audio|image|dall-e|moderation|realtime|transcribe|sora|davinci|babbage|curie|ada|instruct|search|similarity|edit|guard|deep-research/.test(
      n,
    )
  ) {
    return -1;
  }

  let s: number;
  if (n.startsWith("gpt-")) s = 100;
  else if (/^o\d/.test(n)) s = 40; // reasoning models: capable, but slow for a chat turn
  else if (n.startsWith("chatgpt-")) s = 10;
  else return -1; // something we do not recognise is not something to gamble a product on

  if (n.includes("nano")) s -= 40; // noticeably worse at holding a thread
  if (n.includes("mini")) s -= 10;
  if (n.includes("pro")) s -= 60; // minutes per answer, and priced like it
  if (n.includes("preview")) s -= 40;
  if (n.includes("latest")) s -= 30; // an alias can change under a tuned agent

  return s + version(n) + dated(n);
}

/**
 * "gpt-realtime-2.1" ranks above "gpt-realtime".
 *
 * The date is stripped first, or "gpt-4o-realtime-preview-2024-12-17" would
 * read as version 2024 and beat everything on the account forever.
 */
function trailingVersion(n: string): number {
  const undated = n.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  const m = undated.match(/-(\d+)(?:\.(\d+))?$/);
  return m ? Number(m[1]) * 5 + Number(m[2] ?? 0) : 0;
}

/** "gpt-5.1" ranks above "gpt-5", which ranks above "gpt-4.1" and "gpt-4o". */
function version(n: string): number {
  const m = n.match(/^gpt-(\d+)(?:\.(\d+))?/);
  if (m) return Number(m[1]) * 5 + Number(m[2] ?? 0);
  const o = n.match(/^o(\d+)/);
  return o ? Number(o[1]) : 0;
}

/**
 * A dated snapshot beats the bare alias of the same family, and a newer
 * snapshot beats an older one.
 *
 * The opposite of the Gemini rule, because the naming is the opposite: with
 * OpenAI the dated id is the stable pin and the bare name is the alias that
 * moves. The bonus is small enough that it only ever breaks ties inside a
 * family — it can never promote gpt-4o-2024-11-20 above gpt-5.
 */
function dated(n: string): number {
  const m = n.match(/-(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 0;
  const days = (Number(m[1]) - 2020) * 365 + Number(m[2]) * 31 + Number(m[3]);
  return 1 + Math.min(0.9, days / 10_000);
}
