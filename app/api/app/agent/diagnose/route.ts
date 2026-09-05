import { getSessionUser } from "@/lib/supabase/app";
import { APP_SUPABASE_URL } from "@/lib/supabase/app-env";
import { getAllowance, MIN_VOICE_SECONDS } from "@/lib/app/allowance";
import { provider } from "@/lib/app/llm";
import { pinnedOpenAI, rankOpenAI, transcribeModel } from "@/lib/app/openai-models";
import { pinned as pinnedGemini } from "@/lib/app/gemini-models";
import {
  pinnedSarvam,
  preferredSarvamModel,
  sarvamChatUrl,
  sarvamHeaders,
} from "@/lib/app/sarvam-models";
import { liveProvider, mintTicket } from "@/lib/app/live-ticket";
import { isOwnerEmail } from "@/lib/analytics/owner";

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

  /**
   * Which database, which person, what the meter says.
   *
   * Added after an hour was lost to a refusal that made no sense: the SQL
   * editor reported twenty minutes of voice left while the app insisted there
   * was none. Every explanation for that is invisible from a screenshot —
   * the app reading a different Supabase project than the one being edited,
   * the session belonging to a second account with the same name, a profile
   * row that never got a plan.
   *
   * So this reports the three facts that separate those cases, from inside
   * the deployed app, as the signed-in user, against the database it is
   * actually talking to. The host is named; no key is ever included.
   */
  const account = {
    signedInAs: user.email ?? null,
    userId: user.id,
    /** Host only. Which project answers is the question; the key is not. */
    database: APP_SUPABASE_URL?.replace(/^https?:\/\//, "").split(".")[0] ?? "not configured",
    /**
     * True when the app has been pointed at a project of its own. If this is
     * false, the app is on the website's original project — and SQL run in
     * the other one changes nothing here.
     */
    usingSeparateAppProject: Boolean(process.env.NEXT_PUBLIC_APP_SUPABASE_URL),
    treatedAsOwner: isOwnerEmail(user.email),
    ownerListConfigured: Boolean(process.env.ANALYTICS_OWNER_EMAILS?.trim()),
    /** Exactly what the voice gate reads, from the same function it calls. */
    allowance: await getAllowance(user.id, user.email),
    minimumToStartACall: MIN_VOICE_SECONDS,
  };

  const p = provider();
  const live = liveProvider();

  /**
   * Actually try to mint a voice credential.
   *
   * Reporting which keys are set says nothing about whether a call can start,
   * and "the mic button does nothing" was impossible to diagnose from a
   * screenshot. This runs the real code path with the real session object and
   * reports the provider's own words — which is the only thing that has ever
   * settled one of these.
   *
   * A short instruction rather than the full one: this is a probe, and the
   * credential is thrown away without being used.
   */
  const ticket = live ? await mintTicket("Diagnostic probe. Say nothing.") : null;

  const voice = {
    /** Who holds the spoken conversation. */
    liveConversation: live ?? "nobody — no key is set, so the mic will refuse",
    liveModelPinned:
      live === "openai" ? pinnedOpenAI("realtime") : live === "gemini" ? pinnedGemini("live") : null,
    /** Whether a call could actually start right now. */
    canStartACall: ticket?.ok ?? false,
    liveModelChosen: ticket?.ok ? ticket.model : ticket?.model ?? null,
    // The provider's verbatim refusal. This is the line to read.
    liveError: ticket && !ticket.ok ? ticket.error : undefined,
    liveUpstreamStatus: ticket && !ticket.ok ? ticket.upstreamStatus : undefined,
    liveUpstreamSaid: ticket && !ticket.ok ? ticket.detail : undefined,
    /**
     * The agent opens a call with one line, spoken by the realtime model
     * itself. There is no separate text-to-speech service any more — that
     * path existed to read a greeting over the opening screen, which is not
     * something the product does.
     */
    openingLine: "spoken by the live model, not synthesised separately",
    openaiKeySet: !!process.env.OPENAI_API_KEY,
    geminiKeySet: !!process.env.GEMINI_API_KEY,
    /**
     * Said plainly, because the bill makes it look like a misconfiguration.
     *
     * Typing and talking pick their provider independently. A Sarvam-only
     * intent still leaves every spoken minute on OpenAI, because Sarvam has
     * no single duplex conversation API to move it to — so an OpenAI invoice
     * arriving while Sarvam's dashboard stays empty is the design working,
     * not a switch that failed to flip.
     */
    whyOpenAIIsStillBilled:
      live === "openai"
        ? "Voice is OpenAI Realtime. The typed provider below is chosen separately, so a Sarvam-only typed path still bills OpenAI for every spoken minute."
        : undefined,
    /**
     * The second model a call quietly pays for: the words on screen are a
     * different, separately billed model from the voice you hear.
     */
    transcriptionModel: live === "openai" ? transcribeModel() : null,
  };

  if (!p) {
    return Response.json({
      ok: false,
      account,
      voice,
      error: "Neither OPENAI_API_KEY nor GEMINI_API_KEY is set on the server.",
    });
  }

  if (p === "openai") return diagnoseOpenAI(voice, account);
  if (p === "sarvam") return diagnoseSarvam(voice, account);
  return diagnoseGemini(voice, account);
}

/* ---------------------------------------------------------------- openai */

async function diagnoseOpenAI(voice: Record<string, unknown>, account: Record<string, unknown>) {
  const key = process.env.OPENAI_API_KEY!;
  const base = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";

  const report: Record<string, unknown> = {
    provider: "openai",
    account,
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
    const { TOOLS } = await import("@/lib/app/agent-tools");
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

async function diagnoseGemini(voice: Record<string, unknown>, account: Record<string, unknown>) {
  const key = process.env.GEMINI_API_KEY!;
  const base =
    process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/models";

  const report: Record<string, unknown> = {
    provider: "gemini",
    account,
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
    const { TOOLS } = await import("@/lib/app/agent-tools");
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

/* ---------------------------------------------------------------- sarvam */

/**
 * Sarvam, asked the same four questions as the other two.
 *
 * One structural difference, and it changes the shape of the answer: there is
 * no model-listing endpoint, so step 1 cannot be "what can this key reach".
 * A wrong model name here comes back as a 404 that looks exactly like a bad
 * key, which is precisely the confusion this route exists to end — so the
 * model being tried is named in the report and the endpoint it was sent to is
 * named beside it, because /v1 and /v2 serve different models and sending a
 * name to the wrong one is the single most likely mistake.
 *
 * Added late, and its absence was itself a bug: with the typed agent on
 * Sarvam this route fell through to the Gemini branch and dereferenced a key
 * that is not set, so the one page that answers "who is actually spending my
 * money" crashed exactly when the answer had become interesting.
 */
async function diagnoseSarvam(voice: Record<string, unknown>, account: Record<string, unknown>) {
  const key = process.env.SARVAM_API_KEY!;
  const model = preferredSarvamModel();
  const url = sarvamChatUrl(model);

  const report: Record<string, unknown> = {
    provider: "sarvam",
    account,
    voice,
    keyLength: key.length,
    keyStartsWith: key.slice(0, 3),
    base: process.env.SARVAM_API_BASE ?? "https://api.sarvam.ai",
    chatModelEnv: pinnedSarvam(),
    chatModelChosen: model,
    endpoint: url,
    /**
     * The whole point of the question that prompted this branch.
     *
     * These are the features whose money moves to Sarvam. Voice is not among
     * them and cannot be, so if the only testing being done is spoken, this
     * list is the reason Sarvam's dashboard reads zero.
     */
    featuresOnSarvam: [
      "agent_chat",
      "resume_extraction",
      "document_read",
      "ats_analysis",
      "resume_generation",
      "resume_rewrite",
    ],
    featuresNotOnSarvam: ["voice_conversation — OpenAI Realtime, by construction"],
  };

  const bare = await trySarvam(url, key, model, {});
  const withTools = bare.ok ? await trySarvam(url, key, model, { tools: true }) : null;
  const full = withTools?.ok ? await trySarvam(url, key, model, { tools: true, big: true }) : null;

  report.tried = [{ model, endpoint: url, bare, withTools, full }];

  if (full?.ok) {
    return Response.json({
      ok: true,
      report,
      verdict: `${model} works on Sarvam, including tools and the full instruction. Typed answers are Sarvam's; spoken ones are still OpenAI's.`,
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
  return Response.json({
    ok: false,
    report,
    verdict: sarvamVerdict(bare.status, model, url),
  });
}

async function trySarvam(
  url: string,
  key: string,
  model: string,
  what: { tools?: boolean; big?: boolean },
) {
  const messages: { role: string; content: string }[] = [];
  if (what.big) {
    const { INSTRUCTIONS } = await import("@/lib/app/agent-brain");
    messages.push({ role: "system", content: INSTRUCTIONS });
  }
  messages.push({ role: "user", content: "Say OK." });

  const body: Record<string, unknown> = { model, messages, max_tokens: 20, temperature: 0 };

  if (what.tools) {
    // The app's own converter, so the schema tested is the schema sent.
    const { TOOLS } = await import("@/lib/app/agent-tools");
    const { toolsForChat } = await import("@/lib/app/llm");
    body.tools = toolsForChat(TOOLS);
  }

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: sarvamHeaders(key),
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

function sarvamVerdict(status: number, model: string, url: string): string {
  if (status === 401 || status === 403)
    return "Sarvam rejected the key. Check SARVAM_API_KEY in Vercel, not only in .env.local.";
  if (status === 404)
    return `Sarvam has no model called "${model}" at ${url}. Sarvam's own models are on /v1 and the open-weight ones on /v2 — a right name at the wrong endpoint gives this same 404.`;
  if (status === 429) return "Rate limited or out of credit on the Sarvam account.";
  if (status === 0) return "Could not reach Sarvam at all from the server.";
  if (status >= 500) return "Sarvam is failing on its own side. Try again shortly.";
  return `Sarvam returned ${status}. Read \`tried[0].bare.message\` — that is Sarvam's own answer.`;
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
