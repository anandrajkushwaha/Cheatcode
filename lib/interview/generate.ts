import "server-only";
import { llmJson } from "@/lib/app/llm";
import type { Resume } from "@/lib/app/resume-schema";
import type { Profile } from "@/lib/app/account";
import { QUESTIONS_PER_INTERVIEW } from "@/lib/interview/plan";
import type { FeedbackArea, FeedbackTip, ResumeAction } from "@/lib/interview/types";

/**
 * The two model calls a mock interview makes.
 *
 * Both are llmJson rather than free text, because both results go into a
 * database and onto a screen with a fixed shape. A prose reply would mean
 * parsing headings out of markdown, and the first answer that used a
 * different heading would silently render an empty report.
 */

/* ------------------------------------------------------------- questions */

export type GeneratedQuestion = { question: string; skill: string };

/**
 * No model answer here any more, and that is the important change.
 *
 * It used to be written alongside the question, which meant it was a generic
 * strong answer composed before anybody had said anything — the same thing a
 * search would have given them. It is now written during marking instead,
 * where it can use their resume and the answer they actually gave, and come
 * back as *their* answer made stronger rather than somebody else's.
 *
 * Dropping it here also makes this call roughly half the tokens.
 */
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
        },
        required: ["question", "skill"],
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
  const years = profile?.years_experience ?? resume?.years_experience;
  if (typeof years === "number") {
    bits.push(years === 0 ? "Experience: fresher, no full-time role yet" : `Experience: ${years} years`);
  }
  const skills = (resume?.skills ?? []).slice(0, 14);
  if (skills.length) bits.push(`Skills on their resume: ${skills.join(", ")}`);
  const target = resume?.target_role || profile?.target_roles?.[0];
  if (target) bits.push(`Aiming for: ${target}`);
  return bits.length ? bits.join("\n") : "No profile details available — pitch the questions at a mid-level candidate.";
}

/**
 * How hard to make it.
 *
 * Written as a rule per band rather than "adjust for their experience",
 * because the difference that matters is not difficulty — it is what the
 * question can assume. Asking a fresher to describe a system they owned is
 * not a hard question, it is an impossible one, and they will blame
 * themselves for having no answer.
 */
function levelRule(years: number | null): string {
  if (years === null) {
    return "Unknown experience — ask questions answerable by someone with two or three years, and avoid anything that assumes team ownership or budget.";
  }
  if (years <= 0) {
    return "FRESHER, no full-time job yet. Ask about coursework, personal projects, internships, and how they would approach something. NEVER ask about leading a team, owning a budget, mentoring, or 'a time at your previous company' — they have none, and a question they cannot answer teaches them nothing.";
  }
  if (years <= 2) {
    return "EARLY CAREER, 1-2 years. Ask about their own work, the craft, and decisions they made on tasks given to them. Not strategy, not hiring, not managing anyone.";
  }
  if (years <= 5) {
    return "MID LEVEL, 3-5 years. Ask about owning a piece of work end to end, trade-offs they chose, working across teams, and mentoring one junior at most.";
  }
  if (years <= 9) {
    return "SENIOR, 6-9 years. Ask about setting direction on a project, influencing people who do not report to them, technical or creative judgement under constraint, and what they would do differently.";
  }
  return "LEAD OR ABOVE, 10+ years. Ask about strategy, building and growing a team, defending a decision to leadership, and outcomes measured in business terms rather than output.";
}

export async function generateQuestions(opts: {
  topic: string;
  kind: "topic" | "role" | "job";
  company: string | null;
  /** For a job-based interview: the skills on the posting. */
  jobSkills?: string[];
  /**
   * The role this whole screen is pitched at.
   *
   * Without it, "Typography" produces questions for a type designer when the
   * person practising is a marketing designer who uses type. The topic says
   * what to ask about; the role says who is being asked.
   */
  role?: string | null;
  profile: Profile | null;
  resume: Resume | null;
  userId: string;
}): Promise<{ ok: true; data: GeneratedQuestion[] } | { ok: false; error: string }> {
  const context =
    opts.kind === "job"
      ? `They are preparing for a specific opening: ${opts.topic}${
          opts.company ? ` at ${opts.company}` : ""
        }.${opts.jobSkills?.length ? ` The posting asks for: ${opts.jobSkills.slice(0, 12).join(", ")}.` : ""}`
      : opts.role && opts.role.toLowerCase() !== opts.topic.toLowerCase()
        ? `They are interviewing for ${opts.role} roles, and want to practise: ${opts.topic}. Ask ${opts.role} questions about that area — not questions for a specialist in it.`
        : `They are interviewing for ${opts.topic} roles.`;

  const years = opts.profile?.years_experience ?? opts.resume?.years_experience ?? null;

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
      "- Do not greet, do not number the questions, do not add commentary.",
      "",
      "Pitch every question at this level:",
      levelRule(years),
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
    rewrites: {
      type: "array",
      items: {
        type: "object",
        properties: {
          position: { type: "integer" },
          answer: { type: "string" },
        },
        required: ["position", "answer"],
      },
    },
    resume_actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
  },
  required: ["verdict", "headline", "areas", "tips", "rewrites", "resume_actions"],
} as const;

const RATINGS = new Set(["Excellent", "Good", "Needs work"]);

export type Rewrite = { position: number; answer: string };

export type MarkedInterview = {
  verdict: string;
  headline: string;
  areas: FeedbackArea[];
  tips: FeedbackTip[];
  /** Their own answer, rewritten. Saved onto the question row. */
  rewrites: Rewrite[];
  resumeActions: ResumeAction[];
};

export async function markInterview(opts: {
  topic: string;
  answers: { position: number; question: string; skill: string; answer: string }[];
  /** Their profile and resume, so the rewrite uses their real experience. */
  profile: Profile | null;
  resume: Resume | null;
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
      "",
      "`rewrites`: one per question — their own answer, rewritten to be the version that gets them hired.",
      "- This is NOT a model answer by an imaginary candidate. It is THEIR answer, improved: same experience, same examples, same job history.",
      "- Use only facts they gave you, here or on the resume below. Never invent a company, a project, a metric or a result. If a number would strengthen it, write the sentence so the gap is obvious — 'which cut review time by about ___' — rather than filling it in for them.",
      "- 110-160 words, first person, spoken register. Something they could actually say out loud, not something written.",
      "- If they skipped the question, write the answer their resume says they could honestly give.",
      "",
      "`resume_actions`: two or three things this interview suggests changing on their RESUME. Not interview advice — resume advice.",
      "- Only things the interview revealed. The best ones are 'you described this at length and it is one line on your resume' or 'you kept reaching for this example, so lead with it'.",
      "- `title` is the change in under 8 words. `detail` is 20-40 words saying what to write and where.",
      "- If the answers revealed nothing about the resume, return an empty list rather than padding it.",
      "",
      "Never invent experience the candidate did not mention. Never award a number or a percentage as a score.",
    ].join("\n"),
    user: [
      `Topic: ${opts.topic}`,
      "",
      "About them — use these facts in the rewrites:",
      candidateBrief(opts.profile, opts.resume),
      resumeEvidence(opts.resume),
      "",
      transcript,
    ]
      .filter(Boolean)
      .join("\n"),
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

  const rewrites: Rewrite[] = (Array.isArray(data.rewrites) ? data.rewrites : [])
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        position: Number(row.position ?? 0) || 0,
        answer: String(row.answer ?? "").trim(),
      };
    })
    .filter((r) => r.position > 0 && r.answer.length > 60);

  const resumeActions: ResumeAction[] = (
    Array.isArray(data.resume_actions) ? data.resume_actions : []
  )
    .map((a) => {
      const row = a as Record<string, unknown>;
      return {
        title: String(row.title ?? "").trim(),
        detail: String(row.detail ?? "").trim(),
      };
    })
    .filter((a) => a.title.length > 3 && a.detail.length > 10)
    .slice(0, 4);

  return {
    ok: true,
    data: {
      verdict: String(data.verdict ?? "").trim() || "Good effort",
      headline: String(data.headline ?? "").trim(),
      areas,
      tips,
      rewrites,
      resumeActions,
    },
  };
}

/* ------------------------------------------------------------ one retake */

const ONE_SCHEMA = {
  type: "object",
  properties: {
    rating: { type: "string" },
    note: { type: "string" },
    tips: {
      type: "array",
      items: {
        type: "object",
        properties: { tip: { type: "string" }, quote: { type: "string" } },
        required: ["tip", "quote"],
      },
    },
    rewrite: { type: "string" },
  },
  required: ["rating", "note", "tips", "rewrite"],
} as const;

export type RemarkedAnswer = {
  rating: FeedbackArea["rating"];
  note: string;
  tips: { tip: string; quote: string }[];
  rewrite: string;
};

/**
 * Mark a single answer again.
 *
 * A focused call rather than re-running the whole interview, because a retry
 * that costs the same as a fresh interview is a retry people will use once.
 * The trade is that the cross-cutting "communication" area is not recomputed
 * — it is a judgement about all four answers together, and re-deriving it
 * from one would make it worse, not fresher. The report says as much.
 */
export async function remarkAnswer(opts: {
  question: string;
  skill: string;
  answer: string;
  previous: string | null;
  profile: Profile | null;
  resume: Resume | null;
  userId: string;
  sessionId: string;
}): Promise<{ ok: true; data: RemarkedAnswer } | { ok: false; error: string }> {
  const result = await llmJson({
    name: "interview_remark",
    meta: { feature: "interview_feedback", userId: opts.userId, sessionId: opts.sessionId },
    temperature: 0.3,
    maxTokens: 1200,
    system: [
      "You are marking one answer in a mock interview. The candidate has already seen feedback on an earlier attempt and is trying again.",
      "",
      "`rating` must be exactly one of: Excellent, Good, Needs work.",
      "`note` is 30-55 words on what this attempt actually did, and — if there was an earlier attempt — whether it improved and how. Be specific, never generically encouraging.",
      "`tips`: exactly two. Each `tip` is 30-55 words and must be an action. Each `quote` must be a sentence copied word for word from THIS attempt; use an empty string only if the answer is too short to quote.",
      "`rewrite` is their answer improved — same experience, same examples, 110-160 words, first person, spoken register. Invent no company, project or number; leave ___ where a number they know would belong.",
      "",
      "Do not praise effort. A weak answer on a second attempt is still Needs work.",
    ].join("\n"),
    user: [
      `Question (tests: ${opts.skill}):`,
      opts.question,
      "",
      "About them:",
      candidateBrief(opts.profile, opts.resume),
      resumeEvidence(opts.resume),
      "",
      opts.previous ? `Their earlier attempt:\n${opts.previous}\n` : "",
      "This attempt:",
      opts.answer,
    ]
      .filter(Boolean)
      .join("\n"),
    schema: ONE_SCHEMA as unknown as Record<string, unknown>,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const data = result.data as Record<string, unknown>;
  const rating = String(data.rating ?? "").trim();

  const tips = (Array.isArray(data.tips) ? data.tips : [])
    .map((t) => {
      const row = t as Record<string, unknown>;
      return { tip: String(row.tip ?? "").trim(), quote: String(row.quote ?? "").trim() };
    })
    .filter((t) => t.tip.length > 0)
    .slice(0, 2);

  return {
    ok: true,
    data: {
      rating: (RATINGS.has(rating) ? rating : "Good") as FeedbackArea["rating"],
      note: String(data.note ?? "").trim(),
      tips,
      rewrite: String(data.rewrite ?? "").trim(),
    },
  };
}

/**
 * The lines from their resume a rewrite can legitimately draw on.
 *
 * Capped and flattened rather than pasted whole: the model needs raw material
 * to write with, not the document. Without this the rewrite has nothing to
 * use and quietly invents a company, which is the one failure that would make
 * this feature actively dangerous in a real interview.
 */
function resumeEvidence(resume: Resume | null): string {
  if (!resume) return "";
  const lines: string[] = [];

  for (const role of (resume.roles ?? []).slice(0, 4)) {
    const head = [role.title, role.company].filter(Boolean).join(" at ");
    if (head) lines.push(`- ${head}`);
    for (const h of (role.highlights ?? []).slice(0, 4)) {
      if (h?.trim()) lines.push(`  · ${h.trim()}`);
    }
  }

  for (const project of (resume.projects ?? []).slice(0, 3)) {
    if (project.name) lines.push(`- Project: ${project.name}`);
    for (const h of (project.highlights ?? []).slice(0, 2)) {
      if (h?.trim()) lines.push(`  · ${h.trim()}`);
    }
  }

  if (resume.summary?.trim()) lines.unshift(`Summary: ${resume.summary.trim()}`);

  return lines.length ? `\nFrom their resume:\n${lines.slice(0, 32).join("\n")}` : "";
}
