import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume, getPrimaryDraft } from "@/lib/app/account";
import { searchJobs } from "@/lib/jobs/query";
import { agentReplyStream, type Turn } from "@/lib/app/agent-chat";
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
  let conversationId: string | null = null;
  try {
    const body = (await request.json()) as { turns?: unknown; conversationId?: unknown };
    // Which conversation this turn belongs to. Without it every spend row is
    // unattributed and the admin screen cannot say what one session cost.
    if (typeof body.conversationId === "string" && body.conversationId) {
      conversationId = body.conversationId;
    }
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
  const allowance = await getAllowance(user.id, user.email);
  if (allowance.messagesLeft <= 0) {
    return bad(outOfMessages(allowance), allowance.configured ? 402 : 503, {
      // Not a paywall when the meter is simply absent — offering an upgrade
      // for our own missing migration would be worse than saying nothing.
      upgrade: allowance.configured && !allowance.paid,
      configured: allowance.configured,
      // And no count either. Sending zero here put "No messages left today."
      // underneath an error that had just said the limits table was missing:
      // two contradictory sentences, and the more prominent one blamed the
      // person for our own deployment. Absent has to stay absent all the way
      // to the screen, not arrive as a zero.
      ...(allowance.configured ? { messagesLeft: 0 } : {}),
    });
  }

  // The jobs the answer is allowed to talk about: the same filtered list the
  // Jobs page would show them, so the agent never mentions a role they cannot
  // then go and find.
  // The draft is the resume the agent is allowed to change; `resume` is the
  // file they uploaded, which it can read and must not rewrite.
  const [profile, resume, draft] = await Promise.all([
    getProfile(),
    getPrimaryResume(),
    getPrimaryDraft(),
  ]);
  const { jobs } = await searchJobs({
    cities: (profile?.preferred_cities ?? []).slice(0, 4),
    maxYears: profile?.years_experience ?? null,
    limit: 12,
  }).catch(() => ({ jobs: [] }));

  /**
   * From here on the answer is streamed.
   *
   * Everything that could refuse — not signed in, throttled, out of
   * messages — has already answered with a real status code above. Once we
   * have decided to answer, the reply goes out as it is written, because the
   * wait for a whole paragraph is what made this feel slow. A failure after
   * this point arrives as an `error` line inside a 200, which is the honest
   * cost of streaming and is why the client reads the body either way.
   *
   * Newline-delimited JSON rather than SSE: the client is our own code, not
   * an EventSource, and one JSON object per line is far less to get wrong.
   */
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const line = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));

      const result = await agentReplyStream(
        {
          turns,
          profile,
          resume,
          draft,
          jobs,
          meta: { feature: "agent_chat", userId: user.id, sessionId: conversationId },
        },
        (chunk) => line({ t: "delta", v: chunk }),
      );

      // Charged only on success. An upstream 503 is our problem, not theirs.
      if (!result.ok) {
        line({ t: "error", error: result.error });
        controller.close();
        return;
      }

      const left = await spend(user.id, { messages: 1 }, user.email);

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

      line({
        t: "done",
        reply: result.reply,
        configured: left.configured,
        ...(left.configured ? { messagesLeft: left.messagesLeft } : {}),
        paid: left.paid,
        ...(show?.jobs.length ? { show } : {}),
        ...(result.actions?.length ? { actions: result.actions } : {}),
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Tells a proxy in front of us not to sit on the bytes until the end,
      // which would undo the entire point of streaming.
      "X-Accel-Buffering": "no",
    },
  });
}
