import { getSessionUser } from "@/lib/supabase/app";
import { saveAnswer } from "@/lib/interview/store";

export const dynamic = "force-dynamic";

/**
 * Save one answer.
 *
 * Called as they move to the next question rather than all at once at the
 * end, so a closed tab three questions in loses one answer instead of four.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });

  let body: { sessionId?: string; questionId?: number; answer?: string; seconds?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that." }, { status: 400 });
  }

  if (!body.sessionId || !body.questionId) {
    return Response.json({ ok: false, error: "Which question?" }, { status: 400 });
  }

  const saved = await saveAnswer({
    sessionId: body.sessionId,
    questionId: body.questionId,
    userId: user.id,
    answer: typeof body.answer === "string" ? body.answer : "",
    seconds: typeof body.seconds === "number" && body.seconds >= 0 ? Math.round(body.seconds) : null,
  });

  if (!saved) return Response.json({ ok: false, error: "Could not save that." }, { status: 502 });
  return Response.json({ ok: true });
}
