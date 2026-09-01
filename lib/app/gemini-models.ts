import "server-only";

/**
 * Which Gemini model to use, decided by asking rather than by guessing.
 *
 * This exists because guessing failed twice in a row. `gemini-flash-latest`
 * works but is a moving target — Google hot-swaps what the alias points at
 * with two weeks' notice, and an agent tuned against one model that silently
 * becomes another changes personality on a Tuesday for no reason anybody can
 * find. Pinning a name from the documentation failed differently: it 404'd,
 * because which models a key can reach depends on the key, the tier and the
 * week, and reading the docs does not settle it.
 *
 * So neither. The API is asked what it has, the best match is chosen, and the
 * answer is cached for the life of the process. An explicit env override is
 * always honoured and never second-guessed — if it is wrong it fails loudly,
 * which is what an explicit choice should do.
 *
 * Shared by the typed agent and the voice one, because they made the same
 * mistake in two files and would have made it a third time.
 */

const ENDPOINT =
  process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/models";

export type Kind = "chat" | "live";

const cache = new Map<Kind, string>();

/**
 * What we reach for before asking.
 *
 * `gemini-flash-latest` for chat, because it is the name that was already
 * working in this codebase — parse-resume.ts and intent.ts have used it since
 * before any of this. It was replaced with a documented stable id on the
 * principle that a hot-swapping alias is bad for a tuned agent, and the
 * replacement 404'd. The principle still holds and it is still worth pinning
 * a stable id once we know which one this key can reach; it is not worth a
 * product that does not answer.
 */
const FIRST_GUESS: Record<Kind, string> = {
  chat: "gemini-flash-latest",
  live: "gemini-3.1-flash-live-preview",
};

export function pinned(kind: Kind): string | null {
  const value = kind === "chat" ? process.env.GEMINI_CHAT_MODEL : process.env.GEMINI_LIVE_MODEL;
  return value?.trim() || null;
}

/** The name to try first: an explicit choice, then what worked last, then a guess. */
export function preferredModel(kind: Kind): string {
  return pinned(kind) ?? cache.get(kind) ?? FIRST_GUESS[kind];
}

/** Remember what actually worked, so the next request goes straight there. */
export function rememberModel(kind: Kind, model: string): void {
  cache.set(kind, model);
}

/**
 * Ask the API what this key can actually use.
 *
 * Returns null when the listing itself fails — the caller then keeps whatever
 * it had and reports honestly, rather than pretending to have fixed anything.
 */
export async function discoverModel(
  key: string,
  kind: Kind,
  /** Names already tried and found wanting, so a retry does not pick them again. */
  exclude: string[] = [],
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?pageSize=200`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  } | null;

  const candidates = (json?.models ?? [])
    .filter((m) => !!m.name)
    .map((m) => ({
      name: m.name!.replace(/^models\//, ""),
      methods: m.supportedGenerationMethods ?? [],
    }));

  const best = candidates
    .filter((c) => !exclude.includes(c.name))
    .map((c) => ({ name: c.name, score: score(c.name, c.methods, kind) }))
    .sort((a, b) => b.score - a.score)[0];

  if (best && best.score > 0) {
    console.info(`gemini: using ${best.name} for ${kind}, chosen from ${candidates.length}`);
    rememberModel(kind, best.name);
    return best.name;
  }

  console.error(`gemini: no usable ${kind} model among ${candidates.length} available`);
  return null;
}

/**
 * How much we want a given model for a given job. Negative means never.
 *
 * Flash for both: the answers are short and the thing has to feel immediate.
 * The exclusions matter more than the preferences — an embedding or image
 * model will not answer a chat turn at all, and picking one would turn a
 * clear 404 into a confusing 400.
 */
function score(name: string, methods: string[], kind: Kind): number {
  const n = name.toLowerCase();

  if (kind === "live") {
    // Live models are named for it and are the only ones that hold a socket.
    if (!n.includes("live")) return -1;
    if (n.includes("translate")) return -1; // speech-to-speech translation, not a chat
    let s = 10;
    if (n.includes("flash")) s += 100;
    if (n.includes("lite")) s -= 20;
    return s + version(n);
  }

  // Chat.
  if (!methods.includes("generateContent")) return -1;
  if (/live|image|tts|embedding|aqa|vision|translate|guard/.test(n)) return -1;

  let s = 1;
  if (n.includes("flash")) s += 100;
  if (n.includes("lite")) s -= 20; // cheaper, noticeably worse at this
  if (n.includes("preview") || n.includes("exp")) s -= 40;

  // An alias, ranked below every stable id but above nothing at all. Banning
  // these outright is what stopped discovery from ever choosing the one model
  // this key could actually use — a model that might change in a fortnight
  // beats a model that does not answer today.
  if (n.includes("latest")) s -= 30;

  return s + version(n);
}

/** "gemini-3.5-flash" ranks above "gemini-2.5-flash". */
function version(n: string): number {
  const m = n.match(/gemini-(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) * 5 + Number(m[2] ?? 0) : 0;
}
