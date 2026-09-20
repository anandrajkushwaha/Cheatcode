import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume, isPaid } from "@/lib/app/account";
import { getInterview } from "@/lib/interview/store";
import {
  askCoach,
  getThread,
  saveExchange,
  countExchanges,
  MAX_EXCHANGES,
} from "@/lib/interview/coach";
import { MOCK_REQUIRES_PRO } from "@/lib/interview/plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One turn of the coaching conversation.
 *
 * GET returns the thread so somebody coming back days later picks up where
 * they stopped rather than starting again. POST sends a message.
 *
 * There is a cap. This is the one unbounded thing in the feature — an
 * interview is two model calls and then it is over, while a conversation is
 * as many as somebody feels like having. Forty exchanges is far more than
 * anybody will use on one report and cheap insurance against a stuck loop.
 */

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Sign in first.", 401);

  const sessionId = new URL(request.url).searchParams.get("session");
  if (!sessionId) return bad("Which interview?");

  const interview = await getInterview(sessionId, user.id, true);
  if (!interview) return bad("Not found.", 404);

  const thread = await getThread(sessionId);
  return Response.json({ ok: true, messages: thread });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Sign in first.", 401);

  let body: { sessionId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return bad("Could not read that.");
  }

  const message = (body.message ?? "").trim().slice(0, 2000);
  if (!body.sessionId) return bad("Which interview?");
  if (message.length < 2) return bad("Say something first.");

  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);
  if (MOCK_REQUIRES_PRO && !isPaid(profile)) {
    return bad("Mock interviews are part of Pro.", 402, { upgrade: true });
  }

  const interview = await getInterview(body.sessionId, user.id, true);
  if (!interview) return bad("Not found.", 404);
  if (!interview.feedback) return bad("Finish the interview first.", 400);

  const used = await countExchanges(body.sessionId);
  if (used >= MAX_EXCHANGES) {
    return bad(
      "That is a long conversation about one interview. Run another and we can pick it up there.",
      429,
    );
  }

  const thread = await getThread(body.sessionId);

  const result = await askCoach({
    interview,
    thread,
    message,
    profile,
    resume: resume?.parsed ?? null,
    userId: user.id,
  });

  if (!result.ok) return bad(result.error, 502);

  // Saved after the reply exists, so a failed model call leaves no orphan
  // question sitting in the thread.
  const saved = await saveExchange({
    sessionId: body.sessionId,
    question: message,
    reply: result.data.reply,
    summary: result.data.summary,
  });

  return Response.json({
    ok: true,
    reply: result.data.reply,
    // The reply is worth showing even if it could not be written down; the
    // screen says so rather than pretending the thread is intact.
    saved,
    left: Math.max(0, MAX_EXCHANGES - used - 1),
  });
}
