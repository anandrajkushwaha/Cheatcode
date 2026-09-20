import "server-only";
import { llmJson } from "@/lib/app/llm";
import type { Resume } from "@/lib/app/resume-schema";
import type { Profile } from "@/lib/app/account";
import { QUESTIONS_PER_INTERVIEW } from "@/lib/interview/plan";
import type { FeedbackArea, FeedbackTip } from "@/lib/interview/types";

/**
 * The two model calls a mock interview makes.
 *
 * Both are llmJson rather than free text, because both results go into a
 * database and onto a screen with a fixed shape. A prose reply would mean
 * parsing headings out of markdown, and the first answer that used a
 * different heading would silently render an empty report.
 */

/* ------------------------------------------------------------- questions */

export type GeneratedQuestion = { question: string; skill: string; modelAnswer: string };

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          skill: { type: "string" },
          model_answer: { type: "string" },
        },
        required: ["question", "skill", "model_answer"],
      },
    },
  },
  required: ["questions"],
} as const;

/**
 * What the interviewer knows about the candidate before they walk in.
 *
 * Kept short on purpose. Pasting an entire resume produces questions that
 * quiz somebody on their own CV — "you worked at X, tell me about X" — which
 * is not what an interview does. The headline, the years and the skills are
 * enough to pitch the questions at the right level.
 */
function candidateBrief(profile: Profile | null, resume: Resume | null): string {
  const bits: string[] = [];
  const title = resume?.headline || profile?.current_title || profile?.headline;
  if (title) bits.push(`Current or most recent title: ${title}`);
  const years = resume?.years_experience ?? profile?.years_experience;
  if (typeof years === "number") {
    bits.push(years === 0 ? "Experience: fresher, no full-time role yet" : `Experience: ${years} years`);
  }
  const skills = (resume?.skills ?? []).slice(0, 14);
  if (skills.length) bits.push(`Skills on their resume: ${skills.join(", ")}`);
  const target = resume?.target_role || profile?.target_roles?.[0];
  if (target) bits.push(`Aiming for: ${target}`);
  return bits.length ? bits.join("\n") : "No profile details available — pitch the questions at a mid-level candidate.";
}

export async function generateQuestions(opts: {
  topic: string;
  kind: "topic" | "role" | "job";
  company: string | null;
  /** For a job-based interview: the skills on the posting. */
  jobSkills?: string[];
  profile: Profile | null;
  resume: Resume | null;
  userId: string;
}): Promise<{ ok: true; data: GeneratedQuestion[] } | { ok: false; error: string }> {
  const context =
    opts.kind === "job"
      ? `They are preparing for a specific opening: ${opts.topic}${
          opts.company ? ` at ${opts.company}` : ""
        }.${opts.jobSkills?.length ? ` The posting asks for: ${opts.jobSkills.slice(0, 12).join(", ")}.` : ""}`
      : `They are practising the topic: ${opts.topic}.`;

  const result = await llmJson({
    name: "interview_questions",
    meta: { feature: "interview_questions", userId: opts.userId },
    temperature: 0.7,
    maxTokens: 2200,
    system: [
      "You are an experienced hiring manager in India conducting a screening interview.",
      `Write exactly ${QUESTIONS_PER_INTERVIEW} questions.`,
      "",
      "Rules:",
      "- Each question tests a DIFFERENT thing. Four questions about the same competency is a wasted interview.",
      "- Ask what a real interviewer asks: how they did something, a decision they made, a trade-off they chose. Not definitions, not trivia, not anything answerable from a textbook.",
      "- One question, one sentence, no multi-part questions with an 'and also'.",
      "- Plain English. The candidate may not be a native speaker; long clauses make a question harder without making it a better test.",
      "- `skill` is the single competency the question tests, three or four words, lowercase.",
      "- `model_answer` is how a strong candidate would answer, in 120-160 words, first person, specific and free of buzzwords. It is shown as a worked example, so it must be worth reading.",
      "- Do not greet, do not number the questions, do not add commentary.",
    ].join("\n"),
    user: [context, "", "About the candidate:", candidateBrief(opts.profile, opts.resume)].join("\n"),
    schema: QUESTION_SCHEMA as unknown as Record<string, unknown>,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const raw = (result.data as { questions?: unknown })?.questions;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "The interviewer could not think of any questions. Try again." };
  }

  const questions = raw
    .map((q) => {
      const row = q as Record<string, unknown>;
      return {
        question: String(row.question ?? "").trim(),
        skill: String(row.skill ?? "").trim().toLowerCase() || "general",
        modelAnswer: String(row.model_answer ?? "").trim(),
      };
    })
    .filter((q) => q.question.length > 8)
    .slice(0, QUESTIONS_PER_INTERVIEW);

  if (questions.length === 0) {
    return { ok: false, error: "The interviewer could not think of any questions. Try again." };
  }

  return { ok: true, data: questions };
}

/* -------------------------------------------------------------- feedback */

const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string" },
    headline: { type: "string" },
    areas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          rating: { type: "string" },
          note: { type: "string" },
        },
        required: ["skill", "rating", "note"],
      },
    },
    tips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          position: { type: "integer" },
          tip: { type: "string" },
          quote: { type: "string" },
        },
        required: ["position", "tip", "quote"],
      },
    },
  },
  required: ["verdict", "headline", "areas", "tips"],
} as const;

const RATINGS = new Set(["Excellent", "Good", "Needs work"]);

export type MarkedInterview = {
  verdict: string;
  headline: string;
  areas: FeedbackArea[];
  tips: FeedbackTip[];
};

export async function markInterview(opts: {
  topic: string;
  answers: { position: number; question: string; skill: string; answer: string }[];
  userId: string;
  sessionId: string;
}): Promise<{ ok: true; data: MarkedInterview } | { ok: false; error: string }> {
  const transcript = opts.answers
    .map(
      (a) =>
        `Q${a.position} (tests: ${a.skill})\n${a.question}\n\nTheir answer:\n${
          a.answer.trim() || "(they skipped this one)"
        }`,
    )
    .join("\n\n---\n\n");

  const result = await llmJson({
    name: "interview_feedback",
    meta: { feature: "interview_feedback", userId: opts.userId, sessionId: opts.sessionId },
    temperature: 0.3,
    maxTokens: 3000,
    system: [
      "You are marking a mock interview. Be useful, specific and kind — this person is nervous and about to go into a real one.",
      "",
      "`verdict` is two or three words on where they stand: e.g. \"Almost ready\", \"Getting there\", \"Interview ready\", \"Needs more work\".",
      "`headline` is one encouraging sentence, under 90 characters. Never sarcastic, never hollow.",
      "",
      "`areas`: one entry per question using that question's `skill`, plus ONE final entry with the skill \"communication\" judging how clearly they expressed themselves across all the answers.",
      "- `rating` must be exactly one of: Excellent, Good, Needs work.",
      "- `note` is 30-55 words saying what they actually did, quoting or naming a specific thing from their answer. No generic praise.",
      "- A skipped or one-line answer is \"Needs work\". Do not award Good for effort.",
      "",
      "`tips`: exactly two per question, so eight in total.",
      "- `position` is that question's number.",
      "- `tip` is 30-55 words, and must be an action: what to add, what to cut, what to quantify. Never \"be more confident\".",
      "- `quote` MUST be a sentence copied word for word from that answer, the one the tip is about. Never invent it, never paraphrase, never quote the question.",
      "- If an answer is empty or too short to quote, give one tip for it with quote set to an empty string.",
      "",
      "Never invent experience the candidate did not mention. Never award a number or a percentage.",
    ].join("\n"),
    user: `Topic: ${opts.topic}\n\n${transcript}`,
    schema: FEEDBACK_SCHEMA as unknown as Record<string, unknown>,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const data = result.data as Record<string, unknown>;

  const areas: FeedbackArea[] = (Array.isArray(data.areas) ? data.areas : [])
    .map((a) => {
      const row = a as Record<string, unknown>;
      const rating = String(row.rating ?? "").trim();
      return {
        skill: String(row.skill ?? "").trim() || "general",
        // An unrecognised rating becomes the middle one rather than rendering
        // a blank chip — the note underneath is the part that carries meaning.
        rating: (RATINGS.has(rating) ? rating : "Good") as FeedbackArea["rating"],
        note: String(row.note ?? "").trim(),
      };
    })
    .filter((a) => a.note.length > 0);

  const tips: FeedbackTip[] = (Array.isArray(data.tips) ? data.tips : [])
    .map((t) => {
      const row = t as Record<string, unknown>;
      return {
        position: Number(row.position ?? 0) || 0,
        tip: String(row.tip ?? "").trim(),
        quote: String(row.quote ?? "").trim(),
      };
    })
    .filter((t) => t.tip.length > 0 && t.position > 0);

  if (areas.length === 0 && tips.length === 0) {
    return { ok: false, error: "The report came back empty. Your answers are saved — try again." };
  }

  return {
    ok: true,
    data: {
      verdict: String(data.verdict ?? "").trim() || "Good effort",
      headline: String(data.headline ?? "").trim(),
      areas,
      tips,
    },
  };
}
