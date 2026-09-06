import "server-only";
import { modelCatalogue, rateFor } from "@/lib/app/ai-cost";

/**
 * Every model each key can actually reach, asked rather than assumed.
 *
 * The settings screen used to offer only the models in the rate table, which
 * was fifteen names — and OpenAI's realtime family alone has nine. Offering a
 * subset and calling it the list is the kind of thing that looks fine until
 * somebody goes looking for the model they know they have.
 *
 * So this asks the provider. `/v1/models` on OpenAI and `/v1beta/models` on
 * Gemini return exactly what that key is entitled to, which is the only list
 * that is true for *this* deployment — model access varies by account, tier
 * and week, and a hard-coded list is a 404 waiting to happen.
 *
 * ------------------------------------------------------------ Sarvam
 *
 * Sarvam has no listing endpoint — `discoverSarvamModel` returns null for
 * exactly this reason. Its models therefore come from the rate table, and the
 * screen says so rather than presenting a short list as if it were complete.
 *
 * ------------------------------------------------------------ the price
 *
 * A model with no rate is listed, not hidden. Hiding it would mean the picker
 * quietly refuses a model the person can see in their own OpenAI console.
 * What it carries instead is a flag: choose it and its spend lands on the
 * dashboard as unpriced. That is a real cost, stated, rather than a choice
 * removed.
 */

export type Kind = "chat" | "realtime";

export type ListedModel = {
  model: string;
  provider: "openai" | "gemini" | "sarvam";
  kind: Kind;
  /**
   * Null when we have no rate — the screen marks these.
   *
   * Every field is optional because a real rate card is not a matched pair of
   * numbers: a realtime model prices text and audio separately, and a
   * translation model is not priced per token at all. Flattening that to
   * `{input, output}` is what let nine different models display one price.
   */
  price: {
    input?: number;
    output?: number;
    audioInput?: number;
    audioOutput?: number;
    perMinute?: number;
    currency: "USD" | "INR";
  } | null;
};

export type ModelList = {
  models: ListedModel[];
  /** Providers we could not ask, and why, so the screen can say. */
  problems: { provider: string; reason: string }[];
  /** Providers whose list is the rate table rather than a live answer. */
  static: string[];
};

/* --------------------------------------------------------------- filters */

/**
 * Which names are a conversation model, and which are a realtime one.
 *
 * Deliberately a filter on obviously-wrong things rather than a whitelist of
 * right ones: an embedding, an image model or a moderation endpoint cannot
 * hold a conversation, and everything else is the account's business rather
 * than ours. A whitelist would go stale the week after it was written, which
 * is the mistake the discovery code in openai-models.ts already exists to
 * avoid.
 */
const NOT_A_CHAT =
  /embedding|whisper|tts|dall-e|moderation|image|vision-preview|search|rerank|audio-speech|transcribe|codex|guard/i;

function openAiKind(id: string): Kind | null {
  if (NOT_A_CHAT.test(id)) return null;
  if (/realtime/i.test(id)) return "realtime";
  if (/^(gpt|o\d|chatgpt)/i.test(id)) return "chat";
  return null;
}

function geminiKind(name: string, methods: string[]): Kind | null {
  if (methods.includes("bidiGenerateContent")) return "realtime";
  if (methods.includes("generateContent")) {
    return NOT_A_CHAT.test(name) ? null : "chat";
  }
  return null;
}

function priceOf(model: string): ListedModel["price"] {
  const rate = rateFor(model);
  if (!rate) return null;
  return {
    ...(rate.input !== undefined ? { input: rate.input } : {}),
    ...(rate.output !== undefined ? { output: rate.output } : {}),
    ...(rate.audioInput !== undefined ? { audioInput: rate.audioInput } : {}),
    ...(rate.audioOutput !== undefined ? { audioOutput: rate.audioOutput } : {}),
    ...(rate.perMinute !== undefined ? { perMinute: rate.perMinute } : {}),
    currency: (rate.currency ?? "USD") as "USD" | "INR",
  };
}

/* ----------------------------------------------------------------- fetch */

async function openAiModels(key: string): Promise<{ models: ListedModel[]; problem?: string }> {
  const base = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        models: [],
        problem:
          res.status === 401
            ? "the key was refused — check OPENAI_API_KEY"
            : `listing failed with ${res.status}`,
      };
    }
    const json = (await res.json()) as { data?: { id?: string }[] };
    const models: ListedModel[] = [];
    for (const m of json.data ?? []) {
      if (!m.id) continue;
      const kind = openAiKind(m.id);
      if (!kind) continue;
      models.push({ model: m.id, provider: "openai", kind, price: priceOf(m.id) });
    }
    return { models };
  } catch (e) {
    return { models: [], problem: String(e).slice(0, 120) };
  }
}

async function geminiModels(key: string): Promise<{ models: ListedModel[]; problem?: string }> {
  const base = (
    process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/models"
  ).replace(/\/models$/, "");
  try {
    const res = await fetch(`${base}/models?pageSize=200`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        models: [],
        problem:
          res.status === 400 || res.status === 403
            ? "the key was refused — check GEMINI_API_KEY"
            : `listing failed with ${res.status}`,
      };
    }
    const json = (await res.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };
    const models: ListedModel[] = [];
    for (const m of json.models ?? []) {
      // Gemini returns "models/gemini-3.8-flash"; everything else in this
      // codebase uses the bare name.
      const name = m.name?.replace(/^models\//, "");
      if (!name) continue;
      const kind = geminiKind(name, m.supportedGenerationMethods ?? []);
      if (!kind) continue;
      models.push({ model: name, provider: "gemini", kind, price: priceOf(name) });
    }
    return { models };
  } catch (e) {
    return { models: [], problem: String(e).slice(0, 120) };
  }
}

/** Sarvam, from the rate table, because there is nothing to ask. */
function sarvamModels(): ListedModel[] {
  return modelCatalogue()
    .filter((e) => e.provider === "sarvam")
    .map((e) => ({
      model: e.model,
      provider: "sarvam" as const,
      kind: "chat" as const,
      price: { input: e.input, output: e.output, currency: e.currency },
    }));
}

/* ----------------------------------------------------------------- cache */

/**
 * Ten minutes, in the process.
 *
 * This is only ever read by the settings screen, so a stale list costs
 * somebody a refresh rather than a wrong answer — and the alternative is two
 * upstream round trips every time an admin opens a page.
 */
const TTL_MS = 10 * 60_000;
let cached: ModelList | null = null;
let loadedAt = 0;

export async function listModels(force = false): Promise<ModelList> {
  if (!force && cached && Date.now() - loadedAt < TTL_MS) return cached;

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const sarvamKey = process.env.SARVAM_API_KEY?.trim();

  const [openai, gemini] = await Promise.all([
    openaiKey ? openAiModels(openaiKey) : Promise.resolve({ models: [], problem: undefined }),
    geminiKey ? geminiModels(geminiKey) : Promise.resolve({ models: [], problem: undefined }),
  ]);

  const problems: ModelList["problems"] = [];
  if (openai.problem) problems.push({ provider: "openai", reason: openai.problem });
  if (gemini.problem) problems.push({ provider: "gemini", reason: gemini.problem });

  const models = [...openai.models, ...gemini.models, ...(sarvamKey ? sarvamModels() : [])].sort(
    (a, b) =>
      a.provider.localeCompare(b.provider) ||
      a.kind.localeCompare(b.kind) ||
      a.model.localeCompare(b.model),
  );

  cached = { models, problems, static: sarvamKey ? ["sarvam"] : [] };
  loadedAt = Date.now();
  return cached;
}
