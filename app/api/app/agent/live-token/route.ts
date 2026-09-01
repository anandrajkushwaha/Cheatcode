import { getSessionUser, createAppAdminClient } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume, isPaid } from "@/lib/app/account";
import { searchJobs } from "@/lib/jobs/query";
import { systemInstruction, TOOLS } from "@/lib/app/agent-brain";

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

const MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";
const AUTH_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/auth_tokens";

/** Below this there is no point starting; the session would end mid-sentence. */
const MIN_SECONDS = 30;

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

export async function POST() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return bad("Voice isn't switched on yet.", 503);

  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);

  if (!isPaid(profile)) {
    return bad("Live voice is part of Pro.", 402, { upgrade: true });
  }

  // How much talking is left today. Read through the admin client because the
  // function is security definer and not granted to the browser's role.
  const db = createAppAdminClient();
  if (!db) return bad("Voice isn't configured on the server.", 503);

  const { data: remainingRaw } = (await db.rpc("agent_voice_remaining", {
    p_user: user.id,
  })) as unknown as { data: number | null };

  const remaining = typeof remainingRaw === "number" ? remainingRaw : 0;
  if (remaining < MIN_SECONDS) {
    return bad("You've used today's voice minutes. Typing still works.", 429, {
      remaining: 0,
      resetsAt: "midnight IST",
    });
  }

  // The same jobs the Jobs page would show them, so the agent never talks
  // about a role they cannot then go and find.
  const { jobs } = await searchJobs({
    cities: (profile?.preferred_cities ?? []).slice(0, 4),
    maxYears: profile?.years_experience ?? null,
    limit: 12,
  }).catch(() => ({ jobs: [] }));

  const now = Date.now();
  let response: Response;
  try {
    response = await fetch(AUTH_ENDPOINT, {
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
          model: `models/${MODEL}`,
          config: {
            responseModalities: ["AUDIO"],
            // The spoken answer and its text are the same turn. Without this
            // the transcript would have to be re-derived from audio, which is
            // both a second bill and a second thing to be wrong.
            outputAudioTranscription: {},
            inputAudioTranscription: {},
            systemInstruction: {
              parts: [{ text: systemInstruction("voice", { profile, resume, jobs }) }],
            },
            tools: TOOLS,
            temperature: 0.4,
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return bad("Could not reach the voice service.", 502);
  }

  if (!response.ok) {
    // Google's error text can carry the project id; it is not for the browser.
    console.error("live-token: auth_tokens returned", response.status, await response.text());
    return bad("Could not start a voice session.", 502);
  }

  const json = (await response.json()) as { name?: string };
  if (!json.name) return bad("The voice service returned no token.", 502);

  return Response.json({
    ok: true,
    token: json.name,
    model: MODEL,
    // So the client can show "7 minutes left" and stop itself before the
    // server has to.
    remaining,
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
