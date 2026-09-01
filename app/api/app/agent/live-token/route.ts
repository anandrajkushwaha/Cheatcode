import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume } from "@/lib/app/account";
import { getAllowance, outOfVoice, MIN_VOICE_SECONDS } from "@/lib/app/allowance";
import { searchJobs } from "@/lib/jobs/query";
import { systemInstruction } from "@/lib/app/agent-brain";
import { liveProvider, mintTicket } from "@/lib/app/live-ticket";

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

export async function POST() {
  if (!liveProvider()) return bad("Live voice isn't switched on yet.", 503);

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
    return bad(outOfVoice(allowance), 402, { upgrade: !allowance.paid, remaining: 0 });
  }

  // The same jobs the Jobs page would show them, so the agent never talks
  // about a role they cannot then go and find.
  const { jobs } = await searchJobs({
    cities: (profile?.preferred_cities ?? []).slice(0, 4),
    maxYears: profile?.years_experience ?? null,
    limit: 12,
  }).catch(() => ({ jobs: [] }));

  const ticket = await mintTicket(systemInstruction("voice", { profile, resume, jobs }));
  if (!ticket.ok) return bad(ticket.error, ticket.status);

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
