import "server-only";
import type { Profile, Resume } from "@/lib/app/account";
import type { JobRow } from "@/lib/jobs/query";

/**
 * What the agent is, in one place.
 *
 * This file is the only place the agent's behaviour is written down. Both
 * channels read from it — typed messages go to generateContent, spoken ones
 * go to the Live API over a WebSocket — and both are handed the same
 * INSTRUCTIONS and the same grounding context. Train it here and both change
 * together; train it in two places and they drift within a week, which is
 * how a product ends up with a chat that knows things the voice does not.
 *
 * The one thing that differs by channel is how the answer is shaped, because
 * a URL read aloud is useless and a paragraph of prose is a poor thing to
 * speak. That is `channelNote()` at the bottom, and it is deliberately the
 * only fork.
 */

export type Channel = "text" | "voice";

/* ------------------------------------------------------------- behaviour */

/**
 * The rules. This is the part to edit when the agent behaves wrongly.
 *
 * Written as plain sentences rather than a bulleted spec because the model
 * reads it as language, not as configuration — "you are not a cheerleader"
 * changes more than `tone: "direct"` does.
 */
export const INSTRUCTIONS = `You are Cheatcode's career agent, talking to one Indian job seeker.

You can see their profile, their resume, and the jobs currently open in our
database. Answer from those. Never invent a job, a company, a salary or a
deadline. If the answer is not in what you were given, say what is missing and
what would fix it — "I can't see your notice period, tell me and I'll filter
better" is a good answer.

How to talk:
- Short. Two or three sentences unless they asked for a list.
- Plain English, or Hinglish if they speak Hinglish. Match them.
- Direct. No "great question", no "I'd be happy to help".
- You are not a cheerleader. If their resume scores 42 out of 100, say the
  number and say what to change first.
- Never guess at a number. "Around 8-10 lakh" when you were given no salary
  data is the kind of answer somebody quits a job on.

When you mention a job, name the company and the title exactly as given.

What you can do today: read their resume, see their profile, search the jobs
we have, and explain how a job fits. What you cannot do yet: apply on their
behalf, edit their resume file, or speak to a recruiter — say so plainly if
asked, rather than implying it is coming.

If they ask about anything other than their career, their resume, or finding
work, answer briefly and bring it back. You are not a general assistant and
pretending otherwise wastes the thing you are good at.`;

/* --------------------------------------------------------------- context */

export type Grounding = {
  profile: Profile | null;
  resume: Resume | null;
  jobs: JobRow[];
};

/**
 * What the model is allowed to know.
 *
 * Assembled by hand rather than by dumping rows, for two reasons: the raw
 * resume text is far more personal data than an answer needs, and every field
 * that goes in costs tokens on every message of every conversation.
 */
export function describe({ profile, resume, jobs }: Grounding): string {
  const lines: string[] = ["--- What you know about this person ---"];

  if (profile) {
    const bits: string[] = [];
    if (profile.full_name) bits.push(`Name: ${profile.full_name}`);
    if (profile.current_title)
      bits.push(
        `Currently: ${profile.current_title}${
          profile.current_company ? ` at ${profile.current_company}` : ""
        }`,
      );
    if (profile.years_experience !== null)
      bits.push(`Experience: ${profile.years_experience} years`);
    if (profile.target_roles?.length) bits.push(`Wants: ${profile.target_roles.join(", ")}`);
    if (profile.preferred_cities?.length)
      bits.push(`Cities: ${profile.preferred_cities.join(", ")}`);
    if (profile.open_to_remote) bits.push("Open to remote");
    if (profile.expected_ctc)
      bits.push(`Expects: ₹${(profile.expected_ctc / 100000).toFixed(1)}L`);
    if (profile.notice_period_days !== null)
      bits.push(`Notice period: ${profile.notice_period_days} days`);
    lines.push(bits.length ? bits.join("\n") : "Profile is empty.");
  } else {
    lines.push("No profile on file.");
  }

  if (resume) {
    lines.push(
      `\nResume: ${resume.file_name ?? "uploaded"}, ATS score ${
        resume.ats_score ?? "unscored"
      } out of 100.`,
    );
    if (resume.skills?.length) lines.push(`Skills read from it: ${resume.skills.join(", ")}`);
    if (resume.parse_error)
      lines.push(`We could not read the details out of it: ${resume.parse_error}`);
  } else {
    lines.push("\nNo resume uploaded yet.");
  }

  lines.push("\n--- Jobs currently open that fit their filters ---");
  if (!jobs.length) {
    lines.push("None right now. Say so rather than inventing one.");
  } else {
    for (const j of jobs.slice(0, 12)) {
      const where = j.cities.length ? j.cities.join("/") : j.is_remote ? "Remote" : "India";
      const years =
        j.years_min !== null ? `, ${j.years_min}${j.years_max ? `-${j.years_max}` : "+"} yrs` : "";
      const pay =
        j.salary_min !== null && (j.salary_currency ?? "INR") === "INR"
          ? `, ₹${(Number(j.salary_min) / 100000).toFixed(0)}L+`
          : "";
      lines.push(
        `- [${j.id}] ${j.title} at ${j.company} (${where}${years}${pay})${
          j.skills.length ? ` — ${j.skills.slice(0, 6).join(", ")}` : ""
        }`,
      );
    }
    lines.push(
      "\nThe bracketed value before each job is its id. When you want to put a job" +
        " in front of them, call show_jobs with those ids — do not read a link aloud" +
        " and do not paste one.",
    );
  }

  return lines.join("\n");
}

/* ----------------------------------------------------------------- tools */

/**
 * The one tool, and the reason voice works at all.
 *
 * A spoken agent cannot hand over a link — reading a URL aloud is useless and
 * spelling one out is worse. So the model speaks the explanation and calls
 * this to put the actual jobs on screen as cards. That split is the whole
 * design: the voice carries the judgement, the screen carries the things you
 * click.
 */
export const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "show_jobs",
        description:
          "Display specific jobs on the user's screen as cards they can open and apply to. " +
          "Call this whenever you talk about particular roles. Only ever pass ids that " +
          "appear in the job list you were given.",
        parameters: {
          type: "OBJECT",
          properties: {
            job_ids: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "The ids of the jobs to show, best fit first. At most six.",
            },
            reason: {
              type: "STRING",
              description:
                "One short line shown above the cards, saying why these. E.g. 'Closest on your Python and Postgres.'",
            },
          },
          required: ["job_ids"],
        },
      },
    ],
  },
];

/* --------------------------------------------------------------- channel */

/**
 * The only thing that differs between speaking and typing.
 *
 * Kept tiny on purpose. Every sentence added here is a way for the two
 * channels to start behaving like two different products.
 */
export function channelNote(channel: Channel): string {
  return channel === "voice"
    ? `\n\nYou are being spoken aloud. Never say a URL, an email address or anything
with slashes in it — call show_jobs and the screen will carry it. Keep answers
to two or three spoken sentences; if there is more, say the headline and offer
the rest. Numbers should be said the way a person says them: "sixty-one out of
a hundred", "about twelve lakh".`
    : `\n\nYou are being read. Short paragraphs. No markdown headings, no bold. A list
only when you are actually listing things.`;
}

/** The complete system instruction for a channel. */
export function systemInstruction(channel: Channel, grounding: Grounding): string {
  return `${INSTRUCTIONS}${channelNote(channel)}\n\n${describe(grounding)}`;
}
