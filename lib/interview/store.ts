import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import type {
  InterviewFeedback,
  InterviewQuestion,
  InterviewSession,
  FeedbackArea,
  FeedbackTip,
  ResumeAction,
} from "@/lib/interview/types";

/**
 * Reading and writing an interview.
 *
 * The admin client throughout, and every function takes a userId it checks
 * against. RLS gives the browser read-only access to its own rows; this
 * module is the only writer, and it is on the server. Passing the id in and
 * filtering on it is what keeps "read session X" from being a way to read
 * somebody else's interview by guessing a uuid.
 */

const MISSING = "80_interviews.sql";

type Db = NonNullable<ReturnType<typeof createAppAdminClient>>;

function db(): Db | null {
  return createAppAdminClient();
}

/* -------------------------------------------------------------- creating */

export async function createSession(opts: {
  userId: string;
  topic: string;
  kind: "topic" | "role" | "job";
  jobId?: string | null;
  company?: string | null;
  questions: { question: string; skill: string }[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const client = db();
  if (!client) return { ok: false, error: "Accounts aren't configured." };

  const { data, error } = await client
    .from("interview_sessions")
    .insert({
      user_id: opts.userId,
      topic: opts.topic,
      kind: opts.kind,
      job_id: opts.jobId ?? null,
      company: opts.company ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    const absent = /relation .*interview_sessions.* does not exist/i.test(error?.message ?? "");
    return {
      ok: false,
      error: absent
        ? `Mock interviews aren't set up in this database yet — run supabase/schemas/${MISSING}.`
        : (error?.message ?? "Could not start the interview."),
    };
  }

  const id = (data as { id: string }).id;

  const rows = opts.questions.map((q, i) => ({
    session_id: id,
    position: i + 1,
    question: q.question,
    skill: q.skill,
  }));

  const inserted = await client.from("interview_questions").insert(rows);
  if (inserted.error) {
    // The session row exists but has no questions, which would render an
    // interview with nothing to ask. Mark it abandoned rather than leaving a
    // broken one in their history.
    await client.from("interview_sessions").update({ status: "abandoned" }).eq("id", id);
    return { ok: false, error: "Could not save the questions. Try again." };
  }

  return { ok: true, id };
}

/* --------------------------------------------------------------- reading */

type SessionRow = {
  id: string;
  topic: string;
  kind: string;
  company: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
};

type QuestionRow = {
  id: number;
  position: number;
  question: string;
  skill: string;
  model_answer: string | null;
};

export type FullInterview = {
  session: InterviewSession;
  questions: InterviewQuestion[];
  feedback: InterviewFeedback | null;
};

/**
 * One interview, whole.
 *
 * `withModelAnswers` is the plan gate. It is a parameter rather than a filter
 * applied by the caller because a model answer that reaches the browser is
 * already leaked — hiding it in the markup is not hiding it.
 */
export async function getInterview(
  id: string,
  userId: string,
  withModelAnswers: boolean,
): Promise<FullInterview | null> {
  const client = db();
  if (!client) return null;

  const { data: s, error } = await client
    .from("interview_sessions")
    .select("id, topic, kind, company, status, started_at, finished_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !s) return null;
  const row = s as SessionRow;

  const [{ data: qs }, { data: as }, { data: fb }] = await Promise.all([
    client
      .from("interview_questions")
      .select("id, position, question, skill, model_answer")
      .eq("session_id", id)
      .order("position", { ascending: true }),
    client
      .from("interview_answers")
      .select("question_id, answer, attempts")
      .eq("session_id", id),
    client
      .from("interview_feedback")
      .select("verdict, headline, areas, tips, resume_actions, coach_summary")
      .eq("session_id", id)
      .maybeSingle(),
  ]);

  const answers = new Map(
    ((as ?? []) as { question_id: number; answer: string; attempts?: number }[]).map((a) => [
      a.question_id,
      { answer: a.answer, attempts: a.attempts ?? 1 },
    ]),
  );

  const questions: InterviewQuestion[] = ((qs ?? []) as QuestionRow[]).map((q) => ({
    id: q.id,
    position: q.position,
    question: q.question,
    skill: q.skill,
    modelAnswer: withModelAnswers ? q.model_answer : null,
    answer: answers.get(q.id)?.answer ?? null,
    attempts: answers.get(q.id)?.attempts ?? 1,
  }));

  const feedbackRow = fb as
    | {
        verdict: string;
        headline: string | null;
        areas: unknown;
        tips: unknown;
        resume_actions?: unknown;
        coach_summary?: string | null;
      }
    | null;

  return {
    session: {
      id: row.id,
      topic: row.topic,
      kind: (row.kind as InterviewSession["kind"]) ?? "topic",
      company: row.company,
      status: (row.status as InterviewSession["status"]) ?? "running",
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    },
    questions,
    feedback: feedbackRow
      ? {
          verdict: feedbackRow.verdict,
          headline: feedbackRow.headline,
          areas: Array.isArray(feedbackRow.areas) ? (feedbackRow.areas as FeedbackArea[]) : [],
          tips: Array.isArray(feedbackRow.tips) ? (feedbackRow.tips as FeedbackTip[]) : [],
          resumeActions: Array.isArray(feedbackRow.resume_actions)
            ? (feedbackRow.resume_actions as ResumeAction[])
            : [],
          coachSummary: feedbackRow.coach_summary?.trim() || null,
        }
      : null,
  };
}

/* --------------------------------------------------------------- writing */

export async function saveAnswer(opts: {
  sessionId: string;
  questionId: number;
  userId: string;
  answer: string;
  seconds: number | null;
}): Promise<boolean> {
  const client = db();
  if (!client) return false;

  // Ownership is checked here rather than trusted from the request: the
  // session id travels through the browser.
  const { data } = await client
    .from("interview_sessions")
    .select("id")
    .eq("id", opts.sessionId)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (!data) return false;

  // Read the attempt count first so a retake increments rather than resets.
  // An upsert cannot do arithmetic on the row it is replacing.
  const { data: existing } = await client
    .from("interview_answers")
    .select("attempts")
    .eq("question_id", opts.questionId)
    .maybeSingle();

  const attempts = ((existing as { attempts?: number } | null)?.attempts ?? 0) + 1;

  const { error } = await client.from("interview_answers").upsert(
    {
      session_id: opts.sessionId,
      question_id: opts.questionId,
      answer: opts.answer.slice(0, 6000),
      channel: "text",
      seconds: opts.seconds,
      attempts,
    },
    { onConflict: "question_id" },
  );

  return !error;
}

/**
 * Fold one re-marked answer back into a finished report.
 *
 * The area for that question's skill is replaced, its two tips are replaced,
 * and the rewrite is written onto the question row. Everything else is left
 * alone — including the cross-cutting communication area, which was a
 * judgement about all four answers and would be wrong if rebuilt from one.
 */
export async function applyRemark(opts: {
  sessionId: string;
  questionId: number;
  position: number;
  skill: string;
  rating: FeedbackArea["rating"];
  note: string;
  tips: { tip: string; quote: string }[];
  rewrite: string;
}): Promise<boolean> {
  const client = db();
  if (!client) return false;

  const { data } = await client
    .from("interview_feedback")
    .select("areas, tips")
    .eq("session_id", opts.sessionId)
    .maybeSingle();

  if (!data) return false;
  const row = data as { areas: unknown; tips: unknown };

  const areas = (Array.isArray(row.areas) ? (row.areas as FeedbackArea[]) : []).map((a) =>
    a.skill.toLowerCase() === opts.skill.toLowerCase()
      ? { skill: a.skill, rating: opts.rating, note: opts.note || a.note }
      : a,
  );

  const tips = [
    ...(Array.isArray(row.tips) ? (row.tips as FeedbackTip[]) : []).filter(
      (t) => t.position !== opts.position,
    ),
    ...opts.tips.map((t) => ({ position: opts.position, tip: t.tip, quote: t.quote })),
  ].sort((a, b) => a.position - b.position);

  const { error } = await client
    .from("interview_feedback")
    .update({ areas, tips })
    .eq("session_id", opts.sessionId);

  if (error) return false;

  if (opts.rewrite) {
    await client
      .from("interview_questions")
      .update({ model_answer: opts.rewrite })
      .eq("id", opts.questionId);
  }

  return true;
}

export async function saveFeedback(
  sessionId: string,
  /**
   * Everything a fresh marking produces. Deliberately not InterviewFeedback:
   * that shape carries `coachSummary`, which belongs to a conversation that
   * has not happened yet and which this write must never touch.
   */
  feedback: Omit<InterviewFeedback, "coachSummary">,
  /**
   * Their answers, rewritten, keyed by question position.
   *
   * Stored on the question rows rather than inside the feedback blob because
   * that is where the reader wants them — under the question they belong to,
   * next to what they actually said.
   */
  rewrites: { position: number; answer: string }[] = [],
): Promise<boolean> {
  const client = db();
  if (!client) return false;

  const { error } = await client.from("interview_feedback").upsert(
    {
      session_id: sessionId,
      verdict: feedback.verdict,
      headline: feedback.headline,
      areas: feedback.areas,
      tips: feedback.tips,
      resume_actions: feedback.resumeActions ?? [],
    },
    { onConflict: "session_id" },
  );
  if (error) return false;

  if (rewrites.length > 0) {
    const { data } = await client
      .from("interview_questions")
      .select("id, position")
      .eq("session_id", sessionId);

    const byPosition = new Map(
      ((data ?? []) as { id: number; position: number }[]).map((q) => [q.position, q.id]),
    );

    // A rewrite that fails to save costs one panel on the report, not the
    // report — so these are fired together and their errors ignored.
    await Promise.all(
      rewrites
        .map((r) => ({ id: byPosition.get(r.position), answer: r.answer }))
        .filter((r) => r.id !== undefined)
        .map((r) =>
          client.from("interview_questions").update({ model_answer: r.answer }).eq("id", r.id!),
        ),
    );
  }

  await client
    .from("interview_sessions")
    .update({ status: "done", finished_at: new Date().toISOString() })
    .eq("id", sessionId);

  return true;
}

/* -------------------------------------------------------------- history */

export type InterviewSummary = {
  id: string;
  topic: string;
  company: string | null;
  status: string;
  startedAt: string;
  verdict: string | null;
};

export async function getHistory(userId: string, limit = 8): Promise<InterviewSummary[]> {
  const client = db();
  if (!client) return [];

  const { data, error } = await client
    .from("interview_sessions")
    .select("id, topic, company, status, started_at, interview_feedback(verdict)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    // A missing table is the normal state before the migration is run, and it
    // must not take the whole screen down with it.
    if (!/does not exist/i.test(error.message)) console.error("[interview] history", error.message);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const fb = r.interview_feedback as { verdict?: string }[] | { verdict?: string } | null;
    const verdict = Array.isArray(fb) ? (fb[0]?.verdict ?? null) : (fb?.verdict ?? null);
    return {
      id: String(r.id),
      topic: String(r.topic ?? ""),
      company: (r.company as string | null) ?? null,
      status: String(r.status ?? "running"),
      startedAt: String(r.started_at ?? ""),
      verdict,
    };
  });
}

/** How many this person has started today — the free-tier cap. */
export async function countToday(userId: string): Promise<number> {
  const client = db();
  if (!client) return 0;

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const { count, error } = await client
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("started_at", since.toISOString());

  if (error) return 0;
  return count ?? 0;
}
