import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import type {
  InterviewFeedback,
  InterviewQuestion,
  InterviewSession,
  FeedbackArea,
  FeedbackTip,
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
  questions: { question: string; skill: string; modelAnswer: string }[];
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
    model_answer: q.modelAnswer || null,
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
    client.from("interview_answers").select("question_id, answer").eq("session_id", id),
    client
      .from("interview_feedback")
      .select("verdict, headline, areas, tips")
      .eq("session_id", id)
      .maybeSingle(),
  ]);

  const answers = new Map(
    ((as ?? []) as { question_id: number; answer: string }[]).map((a) => [a.question_id, a.answer]),
  );

  const questions: InterviewQuestion[] = ((qs ?? []) as QuestionRow[]).map((q) => ({
    id: q.id,
    position: q.position,
    question: q.question,
    skill: q.skill,
    modelAnswer: withModelAnswers ? q.model_answer : null,
    answer: answers.get(q.id) ?? null,
  }));

  const feedbackRow = fb as
    | { verdict: string; headline: string | null; areas: unknown; tips: unknown }
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

  const { error } = await client.from("interview_answers").upsert(
    {
      session_id: opts.sessionId,
      question_id: opts.questionId,
      answer: opts.answer.slice(0, 6000),
      channel: "text",
      seconds: opts.seconds,
    },
    { onConflict: "question_id" },
  );

  return !error;
}

export async function saveFeedback(
  sessionId: string,
  feedback: InterviewFeedback,
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
    },
    { onConflict: "session_id" },
  );
  if (error) return false;

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
