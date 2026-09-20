import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume, isPaid } from "@/lib/app/account";
import { getInterview, saveAnswer, applyRemark } from "@/lib/interview/store";
import { remarkAnswer } from "@/lib/interview/generate";
import { MOCK_REQUIRES_PRO } from "@/lib/interview/plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Answer one question again.
 *
 * This is the thing a mock interview is for and the thing Naukri's does not
 * have: read what was wrong, say it better, and find out whether it landed.
 * Reading feedback once is revision; doing it again is practice.
 *
 * It re-marks only that answer. Re-running the whole interview would cost the
 * same as a fresh one and nobody would use a retry that expensive.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });

  let body: { sessionId?: string; questionId?: number; answer?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that." }, { status: 400 });
  }

  const answer = (body.answer ?? "").trim();
  if (!body.sessionId || !body.questionId) {
    return Response.json({ ok: false, error: "Which question?" }, { status: 400 });
  }
  if (answer.length < 20) {
    return Response.json(
      { ok: false, error: "Give it a proper go — a line or two is not an answer to mark." },
      { status: 400 },
    );
  }

  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);
  const paid = isPaid(profile);

  if (MOCK_REQUIRES_PRO && !paid) {
    return Response.json(
      { ok: false, error: "Mock interviews are part of Pro.", upgrade: true },
      { status: 402 },
    );
  }

  const full = await getInterview(body.sessionId, user.id, true);
  if (!full) return Response.json({ ok: false, error: "Not found." }, { status: 404 });

  const question = full.questions.find((q) => q.id === body.questionId);
  if (!question) {
    return Response.json({ ok: false, error: "That question is not in this interview." }, { status: 404 });
  }

  // Retries are capped. Without a limit this is an unmetered model call
  // behind a button somebody can hold down.
  if (question.attempts >= 4) {
    return Response.json(
      { ok: false, error: "That is four attempts at this one. Start a fresh interview instead." },
      { status: 429 },
    );
  }

  const marked = await remarkAnswer({
    question: question.question,
    skill: question.skill,
    answer,
    previous: question.answer,
    profile,
    resume: resume?.parsed ?? null,
    userId: user.id,
    sessionId: full.session.id,
  });

  if (!marked.ok) return Response.json({ ok: false, error: marked.error }, { status: 502 });

  // Saved after marking, so a failed model call leaves the earlier attempt
  // and its feedback intact rather than wiping it for nothing.
  await saveAnswer({
    sessionId: full.session.id,
    questionId: question.id,
    userId: user.id,
    answer,
    seconds: null,
  });

  const applied = await applyRemark({
    sessionId: full.session.id,
    questionId: question.id,
    position: question.position,
    skill: question.skill,
    rating: marked.data.rating,
    note: marked.data.note,
    tips: marked.data.tips,
    rewrite: marked.data.rewrite,
  });

  if (!applied) {
    return Response.json({ ok: false, error: "Could not update the report." }, { status: 502 });
  }

  return Response.json({ ok: true, rating: marked.data.rating });
}
