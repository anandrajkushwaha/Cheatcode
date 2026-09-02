import type { Resume } from "@/lib/app/account";

/**
 * The first thing the agent says, and when.
 *
 * It used to say all of this out loud the moment the screen opened, which was
 * wrong twice over. Opening a screen is not asking a question, so being read a
 * paragraph is an interruption; and the paragraph was a list of capabilities,
 * which is the tone of a hold message. Worse, it opened by apologising for a
 * resume it could not read — a sentence that was true for about a week and is
 * now simply false.
 *
 * So there are two things here and they happen at different moments. The
 * heading goes on screen, silently, the instant the screen opens. The opening
 * line is only ever said when somebody starts a call, because that is the
 * moment where silence is awkward rather than peaceful — and it is said by the
 * live voice itself, so a call does not begin with two different voices.
 *
 * Composed rather than generated. A model call here would cost money and half
 * a second on every open to produce a sentence whose only job is to prove it
 * already knows who you are.
 */

/** First name only. "Hi Anand Raj Kushwaha" is how a bank talks. */
export function firstName(fullName: string | null | undefined): string | undefined {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || undefined;
}

export function headingFor(name: string | undefined): string {
  return name ? `Hey ${name}. What can I help with?` : "What can I help with?";
}

/**
 * Short, casual, and about their career rather than about us.
 *
 * Every one of these is one sentence and ends on a question, because the point
 * of the line is to hand the conversation straight back. None of them explains
 * what the agent can do: somebody who pressed "talk" has already decided to
 * talk, and being sold to at that moment is exactly the wrong note.
 *
 * The list is filtered to what is true right now — "your resume's sitting at
 * seventy-nine" is only worth saying if it is — and one is picked at random,
 * because somebody who opens this five times a week should not hear the same
 * sentence five times.
 */
export function openings(
  name: string | undefined,
  resume: Resume | null,
  openRoles: number,
): string[] {
  const hey = name ? `Hey ${name}` : "Hey";

  const lines = [
    `${hey}, what's going on?`,
    `${hey} — what are we working on?`,
    `${hey}. What's on your mind, career-wise?`,
  ];

  if (!resume) {
    lines.push(
      `${hey}. No resume from you yet — want to start there, or just talk?`,
      `${hey}, what do you actually do for a living?`,
    );
    return lines;
  }

  if (resume.parse_error || !resume.parsed) {
    lines.push(`${hey}. Your resume file gave me some trouble — tell me what you do?`);
    return lines;
  }

  const score = typeof resume.ats_score === "number" ? resume.ats_score : null;
  if (score !== null) {
    lines.push(
      `${hey}. Your resume's sitting at ${score} — want to do something about that?`,
      `${hey}, I've got your resume in front of me. Where do we start?`,
    );
  }

  if (openRoles > 0) {
    lines.push(
      openRoles === 1
        ? `${hey}. There's one role open that actually fits you. Want it?`
        : `${hey}. ${openRoles} roles open that fit you — want those, or something else?`,
    );
  }

  const title = resume.latest_title?.trim();
  if (title) lines.push(`${hey}. Still ${title.toLowerCase()}, or are we changing that?`);

  return lines;
}

export function greeting(
  fullName: string | null | undefined,
  resume: Resume | null,
  openRoles: number,
): { heading: string; opening: string } {
  const name = firstName(fullName);
  const list = openings(name, resume, openRoles);
  return {
    heading: headingFor(name),
    opening: list[Math.floor(Math.random() * list.length)],
  };
}
