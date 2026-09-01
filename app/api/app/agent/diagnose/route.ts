import { getSessionUser } from "@/lib/supabase/app";
import { provider } from "@/lib/app/llm";
import { pinnedOpenAI, rankOpenAI } from "@/lib/app/openai-models";
import { pinned as pinnedGemini } from "@/lib/app/gemini-models";
import { liveProvider } from "@/lib/app/live-ticket";
import { ttsProvider } from "@/lib/app/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * What the provider actually says, in one request.
 *
 * Built because two rounds of fixing this were spent guessing from a status
 * code. The app collapses upstream failures into a sentence a job seeker can
 * read, which is right for them and useless for working out why nothing
 * works — the real message never reaches anybody who could act on it.
 *
 * So this asks the questions in order and reports each answer verbatim:
 *
 *   1. Can the key list models at all?  (wrong key, wrong project, no API)
 *   2. Does the plainest possible request work?  (model reachable at all)
 *   3. Does it still work with our tools attached?  (schema rejected)
 *   4. Does it still work with the real system instruction?  (size, content)
 *
 * The first step that fails is the answer.
 *
 * It runs against whichever provider the typed agent is configured for, and
 * reports the two voice halves separately, because they are chosen
 * independently: a key change can leave typing fine and the mic dead, and
 * that is the exact failure this section exists to make obvious.
 *
 * Signed in only, and it returns the provider's error text — which can name
 * the project or the organisation — so it is for the person running the app,
 * not for users.
 */

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const p = provider();
  const live = liveProvider();
  const tts = ttsProvider();

  const voice = {
    /** Who holds the spoken conversation. */
    liveConversation: live ?? "nobody — no key is set, so the mic will refuse",
    liveModelPinned:
      live === "openai" ? pinnedOpenAI("realtime") : live === "gemini" ? pinnedGemini("live") : null,
    /** Who says the greeting. */
    greeting: tts ?? "the browser's own voice — no key is set",
    openaiKeySet: !!process.env.OPENAI_API_KEY,
    geminiKeySet: !!process.env.GEMINI_API_KEY,
    elevenlabsKeySet: !!process.env.ELEVENLABS_API_KEY,
  };

  if (!p) {
    return Response.json({
      ok: false,
      voice,
      error: "Neither OPENAI_API_KEY nor GEMINI_API_KEY is set on the server.",
    });
  }

  return p === "openai" ? diagnoseOpenAI(voice) : diagnoseGemini(voice);
}

/* ---------------------------------------------------------------- openai */

async function diagnoseOpenAI(voice: Record<string, unknown>) {
  const key = process.env.OPENAI_API_KEY!;
  const base = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";

  const report: Record<string, unknown> = {
    provider: "openai",
    voice,
    keyLength: key.length,
    keyStartsWith: key.slice(0, 3),
    base,
    chatModelEnv: pinnedOpenAI(),
  };

  /* ---------------------------------------------------- 1. list models */

  let ranked: string[] = [];
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    report.listStatus = res.status;

    if (!res.ok) {
      report.listError = text.slice(0, 600);
      return Response.json({ ok: false, report, verdict: openaiVerdict(res.status) });
    }

    const json = JSON.parse(text) as { data?: { id?: string }[] };
    const all = (json.data ?? []).map((m) => m.id).filter((id): id is string => !!id);
    ranked = rankOpenAI(all);
    report.usableModels = ranked.slice(0, 12);
    report.modelsOnKey = all.length;
  } catch (e) {
    report.listError = String(e);
    return Response.json({ ok: false, report, verdict: "Could not reach OpenAI at all." });
  }

  if (!ranked.length) {
    return Response.json({
      ok: false,
      report,
      verdict: "The key works but none of the models on it can hold a conversation.",
    });
  }

  /* -------------------------------------------- 2, 3, 4. the real thing */

  const candidates = pinnedOpenAI() ? [pinnedOpenAI()!] : ranked.slice(0, 3);
  report.tried = [];

  for (const model of candidates) {
    const bare = await tryOpenAI(base, key, model, {});
    const withTools = bare.ok ? await tryOpenAI(base, key, model, { tools: true }) : null;
    const full = withTools?.ok
      ? await tryOpenAI(base, key, model, { tools: true, big: true })
      : null;

    (report.tried as unknown[]).push({ model, bare, withTools, full });

    if (full?.ok) {
      return Response.json({
        ok: true,
        report,
        verdict: `${model} works, including tools and the full instruction.`,
      });
    }
    if (bare.ok && withTools && !withTools.ok) {
      return Response.json({
        ok: false,
        report,
        verdict: `${model} answers a plain request but rejects our tool schema. That is the bug.`,
      });
    }
    if (bare.ok && full && !full.ok) {
      return Response.json({
        ok: false,
        report,
        verdict: `${model} answers a small request but fails on the full system instruction.`,
      });
    }
  }

  return Response.json({
    ok: false,
    report,
    verdict:
      "Every candidate model failed even on a one-word request. Read the status and message under `tried` — that is OpenAI's own answer.",
  });
}

async function tryOpenAI(
  base: string,
  key: string,
  model: string,
  what: { tools?: boolean; big?: boolean },
) {
  const body: Record<string, unknown> = {
    model,
    input: [{ role: "user", content: "Say OK." }],
    max_output_tokens: 1500,
    store: false,
  };

  if (what.tools) {
    // The same conversion the app does, so a schema the app would send is the
    // schema that gets tested.
    const { TOOLS } = await import("@/lib/app/agent-brain");
    const { toolsForOpenAI } = await import("@/lib/app/llm");
    body.tools = toolsForOpenAI(TOOLS);
  }
  if (what.big) {
    const { INSTRUCTIONS } = await import("@/lib/app/agent-brain");
    body.instructions = INSTRUCTIONS;
  }

  const started = Date.now();
  try {
    const res = await fetch(`${base}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      message: res.ok ? undefined : messageFrom(text),
    };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, message: String(e).slice(0, 300) };
  }
}

function openaiVerdict(status: number): string {
  if (status === 401)
    return "The key is rejected — wrong key, revoked, or from a different organisation.";
  if (status === 403)
    return "The key is valid but not allowed to do this — check the project's model permissions.";
  if (status === 429) return "Quota or rate limit hit on this key.";
  if (status >= 500) return "OpenAI is failing on its own listing endpoint. Try again shortly.";
  return `Listing models returned ${status}.`;
}

/* ---------------------------------------------------------------- gemini */

async function diagnoseGemini(voice: Record<string, unknown>) {
  const key = process.env.GEMINI_API_KEY!;
  const base =
    process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/models";

  const report: Record<string, unknown> = {
    provider: "gemini",
    voice,
    keyLength: key.length,
    keyStartsWith: key.slice(0, 4),
    base,
    chatModelEnv: pinnedGemini("chat"),
    liveModelEnv: pinnedGemini("live"),
  };

  /* ---------------------------------------------------- 1. list models */

  let models: string[] = [];
  try {
    const res = await fetch(`${base}?pageSize=200`, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    report.listStatus = res.status;

    if (!res.ok) {
      report.listError = text.slice(0, 600);
      return Response.json({ ok: false, report, verdict: geminiVerdict(res.status) });
    }

    const json = JSON.parse(text) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };
    models = (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name!.replace(/^models\//, ""));
    report.generateContentModels = models;
  } catch (e) {
    report.listError = String(e);
    return Response.json({ ok: false, report, verdict: "Could not reach Google at all." });
  }

  if (!models.length) {
    return Response.json({
      ok: false,
      report,
      verdict: "The key works but no model on it supports generateContent.",
    });
  }

  /* -------------------------------------------- 2, 3, 4. the real thing */

  // Try the ones we would actually pick, in order, so the answer reflects
  // what the app does rather than what some other model would have done.
  const candidates = models
    .filter((m) => m.includes("flash") && !/live|image|tts|latest/.test(m))
    .slice(0, 4);

  report.tried = [];

  for (const model of candidates.length ? candidates : models.slice(0, 2)) {
    const bare = await tryGemini(base, key, model, {});
    const withTools = bare.ok ? await tryGemini(base, key, model, { tools: true }) : null;
    const full = withTools?.ok
      ? await tryGemini(base, key, model, { tools: true, big: true })
      : null;

    (report.tried as unknown[]).push({ model, bare, withTools, full });

    if (full?.ok) {
      return Response.json({
        ok: true,
        report,
        verdict: `${model} works, including tools and the full instruction. If the app still fails, it is intermittent load — retry harder or enable billing.`,
      });
    }
    if (bare.ok && withTools && !withTools.ok) {
      return Response.json({
        ok: false,
        report,
        verdict: `${model} answers a plain request but rejects our tool schema. That is the bug.`,
      });
    }
    if (bare.ok && full && !full.ok) {
      return Response.json({
        ok: false,
        report,
        verdict: `${model} answers a small request but fails on the full system instruction.`,
      });
    }
  }

  return Response.json({
    ok: false,
    report,
    verdict:
      "Every candidate model failed even on a one-word request. Read the status and message under `tried` — that is Google's own answer.",
  });
}

async function tryGemini(
  base: string,
  key: string,
  model: string,
  what: { tools?: boolean; big?: boolean },
) {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: "Say OK." }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 20 },
  };

  if (what.tools) {
    const { TOOLS } = await import("@/lib/app/agent-brain");
    body.tools = TOOLS;
  }
  if (what.big) {
    const { INSTRUCTIONS } = await import("@/lib/app/agent-brain");
    body.systemInstruction = { parts: [{ text: INSTRUCTIONS }] };
  }

  const started = Date.now();
  try {
    const res = await fetch(`${base}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      // The provider's message is the only thing here worth reading.
      message: res.ok ? undefined : messageFrom(text),
    };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, message: String(e).slice(0, 300) };
  }
}

function geminiVerdict(status: number): string {
  if (status === 400) return "The key is malformed.";
  if (status === 401 || status === 403)
    return "The key is rejected — wrong key, or the Generative Language API is not enabled on that project.";
  if (status === 429) return "Quota exhausted on this key.";
  if (status >= 500) return "Google is failing on its own listing endpoint. Try again shortly.";
  return `Listing models returned ${status}.`;
}

/* ---------------------------------------------------------------- shared */

function messageFrom(text: string): string {
  try {
    const j = JSON.parse(text) as {
      error?: { message?: string; status?: string; type?: string; code?: string };
    };
    return `${j.error?.status ?? j.error?.type ?? j.error?.code ?? ""} ${j.error?.message ?? ""}`
      .trim()
      .slice(0, 500);
  } catch {
    return text.slice(0, 500);
  }
}
