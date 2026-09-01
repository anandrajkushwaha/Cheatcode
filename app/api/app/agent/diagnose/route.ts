import { getSessionUser } from "@/lib/supabase/app";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * What Google actually says, in one request.
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
 * The first step that fails is the answer. Signed in only, and it returns
 * Google's error text — which can name the project — so it is for the person
 * running the app, not for users.
 */

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!key) {
    return Response.json({ ok: false, error: "GEMINI_API_KEY is not set on the server." });
  }

  const base =
    process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/models";

  const report: Record<string, unknown> = {
    keyLength: key.length,
    keyStartsWith: key.slice(0, 4),
    base,
    chatModelEnv: process.env.GEMINI_CHAT_MODEL ?? null,
    liveModelEnv: process.env.GEMINI_LIVE_MODEL ?? null,
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
      return Response.json({ ok: false, report, verdict: verdictFor(res.status) });
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
    const bare = await attempt(base, key, model, { plain: true });
    const withTools = bare.ok ? await attempt(base, key, model, { tools: true }) : null;
    const full = withTools?.ok ? await attempt(base, key, model, { tools: true, big: true }) : null;

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

/* ---------------------------------------------------------------- helper */

async function attempt(
  base: string,
  key: string,
  model: string,
  what: { plain?: boolean; tools?: boolean; big?: boolean },
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
      // Google's message is the only thing here worth reading.
      message: res.ok ? undefined : messageFrom(text),
    };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, message: String(e).slice(0, 300) };
  }
}

function messageFrom(text: string): string {
  try {
    const j = JSON.parse(text) as { error?: { message?: string; status?: string } };
    return `${j.error?.status ?? ""} ${j.error?.message ?? ""}`.trim().slice(0, 500);
  } catch {
    return text.slice(0, 500);
  }
}

function verdictFor(status: number): string {
  if (status === 400) return "The key is malformed.";
  if (status === 401 || status === 403)
    return "The key is rejected — wrong key, or the Generative Language API is not enabled on that project.";
  if (status === 429) return "Quota exhausted on this key.";
  if (status >= 500) return "Google is failing on its own listing endpoint. Try again shortly.";
  return `Listing models returned ${status}.`;
}
