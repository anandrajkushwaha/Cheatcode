import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume } from "@/lib/app/account";
import { getAllowance, outOfVoice, MIN_VOICE_SECONDS } from "@/lib/app/allowance";
import { searchJobs } from "@/lib/jobs/query";
import { systemInstruction, TOOLS } from "@/lib/app/agent-brain";
import { discoverModel, pinned, preferredModel, rememberModel } from "@/lib/app/gemini-models";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * A ticket to talk to the agent, good for one session.
 *
 * The Live API is a WebSocket the browser has to open itself — there is no
 * way to proxy it from here, because a serverless function cannot hold a
 * socket open for the length of a conversation. That leaves one problem: the
 * browser needs credentials, and GEMINI_API_KEY in a browser is a key on the
 * internet.
 *
 * Ephemeral tokens are the answer. This route holds the real key, asks Google
 * for a token that works once and expires in minutes, and hands that over.
 * The constraints go in the token itself rather than being sent from the
 * browser at connect time — model, system instruction, tools and voice are
 * all baked in here, so a modified client cannot ask the paid model to do
 * something else on our bill.
 *
 * It is also the only place that can say no: the paid gate and the daily
 * minute allowance are both checked before a token exists.
 */

const AUTH_ENDPOINT =
  (process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com/v1beta/models")
    .replace(/\/models$/, "") + "/auth_tokens";

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

export async function POST() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return bad("Voice isn't switched on yet.", 503);

  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  const [profile, resume, allowance] = await Promise.all([
    getProfile(),
    getPrimaryResume(),
    getAllowance(user.id),
  ]);

  // One gate for both questions. A free account is not refused because it is
  // free — it is refused when its trial is spent, which is a different
  // sentence and a much better one to read the first time you press the mic.
  if (allowance.voiceLeft < MIN_VOICE_SECONDS) {
    return bad(outOfVoice(allowance), 402, {
      upgrade: !allowance.paid,
      remaining: 0,
    });
  }

  const remaining = allowance.voiceLeft;

  // The same jobs the Jobs page would show them, so the agent never talks
  // about a role they cannot then go and find.
  const { jobs } = await searchJobs({
    cities: (profile?.preferred_cities ?? []).slice(0, 4),
    maxYears: profile?.years_experience ?? null,
    limit: 12,
  }).catch(() => ({ jobs: [] }));

  const now = Date.now();
  const instruction = systemInstruction("voice", { profile, resume, jobs });

  const ask = (model: string) =>
    fetch(AUTH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        uses: 1,
        // Long enough for a conversation, short enough that a token found in
        // a log tomorrow is worthless.
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        // The window to *open* the socket, not to talk. A minute is plenty
        // for a click, and it means a leaked token is almost always dead.
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: {
          model: `models/${model}`,
          config: {
            responseModalities: ["AUDIO"],
            // The spoken answer and its text are the same turn. Without this
            // the transcript would have to be re-derived from audio, which is
            // both a second bill and a second thing to be wrong.
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            systemInstruction: { parts: [{ text: instruction }] },
            tools: TOOLS,
            temperature: 0.4,
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

  let model = preferredModel("live");
  let response: Response;
  try {
    response = await ask(model);

    // Same lesson as the typed agent: which models a key can reach is not
    // knowable from the documentation, so on a 404 the API is asked what it
    // has. An explicitly set GEMINI_LIVE_MODEL is never second-guessed.
    if (response.status === 404 && !pinned("live")) {
      const found = await discoverModel(key, "live");
      if (found && found !== model) {
        model = found;
        response = await ask(model);
      }
    }
  } catch {
    return bad("Could not reach the voice service.", 502);
  }

  if (!response.ok) {
    // Google's error text can carry the project id; it is not for the browser.
    console.error("live-token: auth_tokens returned", response.status, await response.text());
    return bad(
      response.status === 404
        ? "No live voice model is available on this API key."
        : "Could not start a voice session.",
      502,
    );
  }

  const json = (await response.json()) as { name?: string };
  if (!json.name) return bad("The voice service returned no token.", 502);

  rememberModel("live", model);

  return Response.json({
    ok: true,
    token: json.name,
    model,
    // So the client can show "7 minutes left" and stop itself before the
    // server has to.
    remaining,
    paid: allowance.paid,
    trial: allowance.voiceIsTrial,
    // Enough of the job list to render a card the moment the model names one,
    // without a second round trip mid-conversation.
    jobs: jobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      cities: j.cities,
      is_remote: j.is_remote,
      apply_url: j.apply_url,
    })),
  });
}
