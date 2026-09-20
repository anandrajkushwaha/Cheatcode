/**
 * Who can take a mock interview.
 *
 * The plan is that this is a Pro feature. It is not gated yet, on purpose:
 * nothing has been tested against real answers, and putting an untested
 * feature behind a paywall means the first person to find a rough edge is
 * somebody who has paid for it.
 *
 * So the switch lives here, as one constant, and flipping it to `true` is the
 * entire launch. Everything downstream — the landing screen, the start route,
 * the report — reads this rather than deciding for itself, so there is no
 * second place to remember.
 *
 * MOCK_REQUIRES_PRO = false  → open to everyone, with a daily cap.
 * MOCK_REQUIRES_PRO = true   → Pro only; free accounts see the paywall.
 */
export const MOCK_REQUIRES_PRO = false;

/**
 * How many a free account may run in a day while the gate is open.
 *
 * A cap even in the free phase, because each interview is two model calls and
 * an unmetered loop is how a testing week turns into a bill. Pro is unmetered.
 */
export const FREE_INTERVIEWS_PER_DAY = 3;

/** How many questions one interview asks. Four is about five minutes. */
export const QUESTIONS_PER_INTERVIEW = 4;

/**
 * Topics offered when we know nothing else about somebody.
 *
 * Replaced by their own target roles and skills the moment the profile or a
 * resume has any, which is the usual case.
 */
export const FALLBACK_TOPICS = [
  "Tell me about yourself",
  "Strengths and weaknesses",
  "Why this role",
  "Handling conflict at work",
  "Salary expectations",
  "Questions to ask the interviewer",
];
