import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume, isPaid } from "@/lib/app/account";
import { createAppAdminClient } from "@/lib/supabase/app";
import { generateQuestions } from "@/lib/interview/generate";
import { createSession, countToday } from "@/lib/interview/store";
import { MOCK_REQUIRES_PRO, FREE_INTERVIEWS_PER_DAY } from "@/lib/interview/plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Open an interview.
 *
 * This is the expensive call — one model round trip writing four questions
 * and four model answers — so it is also where the plan is enforced. Doing it
 * here rather than on the page means a crafted POST cannot get a free
 * interview by skipping the screen that would have refused.
 */

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  Response.json({ ok: false, error, ...extra }, { status });

type Body = {
  topic?: string;
  kind?: "topic" | "role" | "job";
  jobId?: string;
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return bad("Sign in first.", 401);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Could not read that request.");
  }

  const profile = await getProfile();
  const paid = isPaid(profile);

  if (MOCK_REQUIRES_PRO && !paid) {
    return bad("Mock interviews are part of Pro.", 402, { upgrade: true });
  }

  // Even while it is open to everybody, there is a cap. Each interview is two
  // model calls, and an unmetered loop is how a week of testing becomes a bill.
  if (!paid) {
    const used = await countToday(user.id);
    if (used >= FREE_INTERVIEWS_PER_DAY) {
      return bad(
        `That is ${FREE_INTERVIEWS_PER_DAY} interviews today. Come back tomorrow, or go Pro for unlimited practice.`,
        429,
        { upgrade: true },
      );
    }
  }

  let topic = (body.topic ?? "").trim().slice(0, 120);
  let kind: "topic" | "role" | "job" = body.kind ?? "topic";
  let company: string | null = null;
  let jobSkills: string[] = [];
  let jobId: string | null = null;

  // A job-based interview takes its subject from the posting rather than from
  // the request, so the topic on screen always matches a real row.
  if (body.jobId) {
    const db = createAppAdminClient();
    if (db) {
      const { data } = await db
        .from("jobs")
        .select("id, title, company, skills")
        .eq("id", body.jobId)
        .maybeSingle();
      const job = data as { id: string; title: string; company: string; skills: string[] } | null;
      if (job) {
        jobId = job.id;
        topic = job.title;
        company = job.company;
        jobSkills = job.skills ?? [];
        kind = "job";
      }
    }
  }

  if (!topic) return bad("Pick something to practise.");

  const resume = await getPrimaryResume();

  const generated = await generateQuestions({
    topic,
    kind,
    company,
    jobSkills,
    role: profile?.interview_role ?? null,
    profile,
    resume: resume?.parsed ?? null,
    userId: user.id,
  });

  if (!generated.ok) return bad(generated.error, 502);

  const created = await createSession({
    userId: user.id,
    topic,
    kind,
    jobId,
    company,
    questions: generated.data,
  });

  if (!created.ok) return bad(created.error, 502);

  return Response.json({ ok: true, id: created.id });
}
