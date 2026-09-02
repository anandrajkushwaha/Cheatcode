import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume, getPrimaryDraft } from "@/lib/app/account";
import { getAllowance, outOfVoice, MIN_VOICE_SECONDS } from "@/lib/app/allowance";
import { searchJobs } from "@/lib/jobs/query";
import { systemInstruction } from "@/lib/app/agent-brain";
import { liveProvider, mintTicket } from "@/lib/app/live-ticket";
import { isOwnerEmail } from "@/lib/analytics/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * A ticket to talk to the agent, good for one session.
 *
 * This route answers two questions and nothing else: who is asking, and are
 * they allowed. The credential itself — which provider, which model, what the
 * agent is permitted to be — is lib/app/live-ticket.ts, kept separate so it
 * can be exercised without a signed-in session.
 *
 * This is the only place that can say no. The paid gate and the voice
 * allowance are both checked before any credential exists, and they are
 * checked once for both providers, because two copies of a paywall is one
 * copy too many.
 */

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

export async function POST(request: Request) {
  if (!liveProvider()) return bad("Live voice isn't switched on yet.", 503);

  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);

  /**
   * What was said before the mic was pressed.
   *
   * A spoken session gets its instructions once, baked into a credential, and
   * is handed no history — so without this the agent starts from nothing and
   * asks for the resume it was given two minutes ago. The browser already has
   * the thread on screen; it sends the tail of it.
   */
  let recap: { role: "user" | "model"; text: string }[] = [];
  try {
    const body = (await request.json().catch(() => ({}))) as { turns?: unknown };
    if (Array.isArray(body.turns)) {
      recap = body.turns
        .filter(
          (t): t is { role: "user" | "model"; text: string } =>
            !!t &&
            typeof t === "object" &&
            "role" in t &&
            (t.role === "user" || t.role === "model") &&
            "text" in t &&
            typeof (t as { text: unknown }).text === "string",
        )
        .slice(-8)
        .map((t) => ({ role: t.role, text: t.text.slice(0, 400) }));
    }
  } catch {
    /* A call with no recap is still a call. */
  }

  const [profile, resume, draft, allowance] = await Promise.all([
    getProfile(),
    getPrimaryResume(),
    getPrimaryDraft(),
    getAllowance(user.id, user.email),
  ]);

  // One gate for both questions. A free account is not refused because it is
  // free — it is refused when its trial is spent, which is a different
  // sentence and a much better one to read the first time you press the mic.
  if (allowance.voiceLeft < MIN_VOICE_SECONDS) {
    // 402 only when there is a meter to be out of. A missing limits table is
    // a 503 and never offers an upgrade — selling Pro to somebody because we
    // failed to run a migration is the worst version of this screen.
    return bad(outOfVoice(allowance), allowance.configured ? 402 : 503, {
      upgrade: allowance.configured && !allowance.paid,
      configured: allowance.configured,
      ...(allowance.configured ? { remaining: 0 } : {}),
    });
  }

  // The same jobs the Jobs page would show them, so the agent never talks
  // about a role they cannot then go and find.
  const { jobs } = await searchJobs({
    cities: (profile?.preferred_cities ?? []).slice(0, 4),
    maxYears: profile?.years_experience ?? null,
    limit: 12,
  }).catch(() => ({ jobs: [] }));

  const ticket = await mintTicket(
    systemInstruction("voice", { profile, resume, draft, jobs, recap }),
  );
  if (!ticket.ok) {
    /**
     * The owner gets the provider's own words; everybody else gets a sentence.
     *
     * "Voice couldn't start. The server log has the reason." is the correct
     * thing to tell a job seeker and a useless thing to tell the person who
     * can fix it — and telling them to go and read a serverless log is how a
     * ten-second bug becomes a three-round conversation. The gate is the same
     * owner-email list the analytics exclusion uses.
     */
    const owner = isOwnerEmail(user.email);
    return bad(
      owner && ticket.detail
        ? `${ticket.error} — ${ticket.upstreamStatus ?? ""} ${ticket.detail}`.trim()
        : ticket.error,
      ticket.status,
    );
  }

  return Response.json({
    ok: true,
    provider: ticket.provider,
    token: ticket.token,
    model: ticket.model,
    ...(ticket.callsUrl ? { callsUrl: ticket.callsUrl } : {}),
    // So the client can show "7 minutes left" and stop itself before the
    // server has to.
    remaining: allowance.voiceLeft,
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
