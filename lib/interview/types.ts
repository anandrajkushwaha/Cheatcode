/**
 * The shapes the interview screens work in.
 *
 * Plain types with no server imports, so a client component can hold one
 * without dragging the database client into the browser bundle.
 */

export type InterviewKind = "topic" | "role" | "job";
export type InterviewStatus = "running" | "done" | "abandoned";

export type InterviewQuestion = {
  id: number;
  position: number;
  question: string;
  /** The one thing this question tests. Becomes a row in the report. */
  skill: string;
  /** Their own answer, rewritten. Written during marking, not before. */
  modelAnswer: string | null;
  /** What they said, if they have answered it yet. */
  answer: string | null;
  /** 1 the first time. Higher once they have gone back and tried again. */
  attempts: number;
};

export type InterviewSession = {
  id: string;
  topic: string;
  kind: InterviewKind;
  company: string | null;
  status: InterviewStatus;
  startedAt: string;
  finishedAt: string | null;
};

/** One line of the left-hand column on the report. */
export type FeedbackArea = {
  skill: string;
  /** Deliberately words, not a number. See 80_interviews.sql. */
  rating: "Excellent" | "Good" | "Needs work";
  note: string;
};

/**
 * One piece of advice, and the sentence of theirs it is about.
 *
 * The quote is what makes the report read as feedback on *your* interview
 * rather than a list of interview tips, so it is required: a tip that cannot
 * point at something you said is dropped rather than shown bare.
 */
export type FeedbackTip = {
  position: number;
  tip: string;
  quote: string;
};

/**
 * What this interview says to change on the resume.
 *
 * Derived from the answers, not from reading the resume again — the value is
 * that it noticed something while they were talking. "You described the
 * migration in detail and it is one line on your resume" is a thing only an
 * interview can tell you.
 */
export type ResumeAction = { title: string; detail: string };

export type InterviewFeedback = {
  verdict: string;
  headline: string | null;
  areas: FeedbackArea[];
  tips: FeedbackTip[];
  resumeActions: ResumeAction[];
};

export const RATING_ORDER: Record<FeedbackArea["rating"], number> = {
  "Needs work": 0,
  Good: 1,
  Excellent: 2,
};
