import { getSessionUser } from "@/lib/supabase/app";
import { isPaid, getProfile, getPrimaryResume } from "@/lib/app/account";
import { getInterview, saveFeedback } from "@/lib/interview/store";
import { markInterview } from "@/lib/interview/generate";
import { MOCK_REQUIRES_PRO } from "@/lib/interview/plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Mark the interview.
 *
 * Idempotent on purpose: a double-click, or a refresh while the report is
 * being written, must not pay for a second marking run. If feedback already
 * exists this returns straight away.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });

  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that." }, { status: 400 });
  }
  if (!body.sessionId) {
    return Response.json({ ok: false, error: "Which interview?" }, { status: 400 });
  }

  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);
  // The marking run is the expensive call, and start/retry/coach already
  // refuse free accounts — without this, a lapsed subscription or a saved
  // interview URL could still get a report written.
  if (MOCK_REQUIRES_PRO && !isPaid(profile)) {
    return Response.json(
      { ok: false, error: "Mock interviews are part of Pro.", upgrade: true },
      { status: 402 },
    );
  }
  const full = await getInterview(body.sessionId, user.id, isPaid(profile));
  if (!full) return Response.json({ ok: false, error: "Not found." }, { status: 404 });

  if (full.feedback) return Response.json({ ok: true, already: true });

  const answered = full.questions.filter((q) => (q.answer ?? "").trim().length > 0);
  if (answered.length === 0) {
    return Response.json(
      { ok: false, error: "There is nothing to mark — every question was skipped." },
      { status: 400 },
    );
  }

  const marked = await markInterview({
    topic: full.session.topic,
    sessionId: full.session.id,
    userId: user.id,
    profile,
    resume: resume?.parsed ?? null,
    answers: full.questions.map((q) => ({
      position: q.position,
      question: q.question,
      skill: q.skill,
      answer: q.answer ?? "",
    })),
  });

  if (!marked.ok) return Response.json({ ok: false, error: marked.error }, { status: 502 });

  const stored = await saveFeedback(full.session.id, marked.data, marked.data.rewrites);
  if (!stored) {
    return Response.json({ ok: false, error: "Could not save the report." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
