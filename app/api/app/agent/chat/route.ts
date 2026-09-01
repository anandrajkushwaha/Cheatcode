import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume } from "@/lib/app/account";
import { searchJobs } from "@/lib/jobs/query";
import { agentReply, type Turn } from "@/lib/app/agent-chat";
import { getAllowance, outOfMessages, spend } from "@/lib/app/allowance";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

/**
 * Best-effort throttle, same shape as the intent route.
 *
 * One instance's memory, so it will not stop somebody determined — it stops
 * the ordinary case, which is a held-down key or a loop. Every message here
 * costs a model call.
 */
const lastCall = new Map<string, number>();
const MIN_GAP_MS = 1_200;

function tooSoon(userId: string): boolean {
  const now = Date.now();
  const prev = lastCall.get(userId);
  if (prev && now - prev < MIN_GAP_MS) return true;
  lastCall.set(userId, now);
  if (lastCall.size > 5_000) {
    for (const [k, t] of lastCall) if (now - t > 60_000) lastCall.delete(k);
  }
  return false;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Not signed in", 401);
  if (tooSoon(user.id)) return bad("One at a time.", 429);

  let turns: Turn[] = [];
  try {
    const body = (await request.json()) as { turns?: unknown };
    if (Array.isArray(body.turns)) {
      turns = body.turns
        .filter(
          (t): t is Turn =>
            !!t &&
            typeof t === "object" &&
            (("role" in t && (t.role === "user" || t.role === "model")) as boolean) &&
            "text" in t &&
            typeof (t as { text: unknown }).text === "string",
        )
        .slice(-12);
    }
  } catch {
    return bad("Could not read that request.");
  }

  if (!turns.length) return bad("Nothing to answer.");

  // The gate. Checked before the model is called, because the model call is
  // the thing that costs money — refusing after it has already run bills us
  // for a message the person never gets to read.
  const allowance = await getAllowance(user.id);
  if (allowance.messagesLeft <= 0) {
    return bad(outOfMessages(allowance), allowance.configured ? 402 : 503, {
      // Not a paywall when the meter is simply absent — offering an upgrade
      // for our own missing migration would be worse than saying nothing.
      upgrade: allowance.configured && !allowance.paid,
      messagesLeft: 0,
    });
  }

  // The jobs the answer is allowed to talk about: the same filtered list the
  // Jobs page would show them, so the agent never mentions a role they cannot
  // then go and find.
  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);
  const { jobs } = await searchJobs({
    cities: (profile?.preferred_cities ?? []).slice(0, 4),
    maxYears: profile?.years_experience ?? null,
    limit: 12,
  }).catch(() => ({ jobs: [] }));

  const result = await agentReply({ turns, profile, resume, jobs });
  // Charged only on success. An upstream 503 is our problem, not theirs.
  if (!result.ok) return bad(result.error, 502);

  const left = await spend(user.id, { messages: 1 });

  // Resolve the ids the model asked for against the list it was given, and
  // send back only what a card needs. Ids it invented resolve to nothing,
  // which is the point: the client cannot render a job that does not exist.
  const show = result.show
    ? {
        reason: result.show.reason,
        jobs: result.show.jobIds
          .map((id) => jobs.find((j) => j.id === id))
          .filter((j): j is (typeof jobs)[number] => !!j)
          .map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            cities: j.cities,
            is_remote: j.is_remote,
            apply_url: j.apply_url,
          })),
      }
    : undefined;

  return Response.json({
    ok: true,
    reply: result.reply,
    messagesLeft: left.messagesLeft,
    paid: left.paid,
    ...(show?.jobs.length ? { show } : {}),
  });
}
