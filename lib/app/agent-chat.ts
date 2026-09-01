import "server-only";
import type { Profile, Resume } from "@/lib/app/account";
import type { JobRow } from "@/lib/jobs/query";

/**
 * The agent's answer, in text.
 *
 * Grounded rather than general: the model is handed this person's profile,
 * what their resume says, and the jobs currently open to them, and is told to
 * answer from those and say so when it cannot. A career assistant that
 * invents an opening is worse than one that admits the list is thin — the
 * first costs somebody an afternoon.
 *
 * This is the text half. When the voice agent lands it will run the same
 * instructions over Gemini Live, so the thing people talk to and the thing
 * people type at behave the same way.
 */

const MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-flash-latest";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export type Turn = { role: "user" | "model"; text: string };

/** Enough context to hold a thread, short enough to stay cheap. */
const MAX_TURNS = 10;
const MAX_CHARS = 1200;

const INSTRUCTIONS = `You are Cheatcode's career agent, talking to one Indian job seeker.

You can see their profile, their resume, and the jobs currently open in our database.
Answer from those. Never invent a job, a company, a salary or a deadline. If the
answer is not in what you were given, say what is missing and what would fix it —
"I can't see your notice period, tell me and I'll filter better" is a good answer.

How to talk:
- Short. Two or three sentences unless they asked for a list.
- Plain English, or Hinglish if they write in Hinglish. Match them.
- Direct. No "great question", no "I'd be happy to help", no bullet points unless
  you are actually listing jobs.
- You are not a cheerleader. If their resume scores 42 out of 100, say the number
  and say what to change first.

When you mention a job, name the company and the title exactly as given. Do not
paste URLs — the cards on the Jobs page carry the links.

What you can do today: read their resume, see their profile, search the jobs we have,
and explain how a job fits. What you cannot do yet: apply on their behalf, edit their
resume file, or talk on a call — say so plainly if asked.`;

export type ChatOk = { ok: true; reply: string };
export type ChatFail = { ok: false; error: string };

export async function agentReply(input: {
  turns: Turn[];
  profile: Profile | null;
  resume: Resume | null;
  jobs: JobRow[];
}): Promise<ChatOk | ChatFail> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "The agent isn't switched on yet." };

  const turns = input.turns
    .filter((t) => t.text.trim())
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role, parts: [{ text: t.text.slice(0, MAX_CHARS) }] }));

  if (!turns.length) return { ok: false, error: "Nothing to answer." };

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${INSTRUCTIONS}\n\n${describe(input)}` }],
        },
        contents: turns,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 400,
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "That took too long. Ask again." : "Could not reach the model.",
    };
  }

  if (response.status === 429) return { ok: false, error: "Too many requests. One moment." };
  if (!response.ok) return { ok: false, error: `The model returned ${response.status}.` };

  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const reply = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!reply) return { ok: false, error: "The model returned nothing." };

  return { ok: true, reply: reply.slice(0, 2000) };
}

/* ---------------------------------------------------------------- context */

/**
 * What the model is allowed to know.
 *
 * Assembled by hand rather than by dumping rows, for two reasons: the raw
 * resume text is far more personal data than an answer needs, and every field
 * that goes in costs tokens on every message of every conversation.
 */
function describe({
  profile,
  resume,
  jobs,
}: {
  profile: Profile | null;
  resume: Resume | null;
  jobs: JobRow[];
}): string {
  const lines: string[] = ["--- What you know about this person ---"];

  if (profile) {
    const bits: string[] = [];
    if (profile.full_name) bits.push(`Name: ${profile.full_name}`);
    if (profile.current_title)
      bits.push(`Currently: ${profile.current_title}${profile.current_company ? ` at ${profile.current_company}` : ""}`);
    if (profile.years_experience !== null)
      bits.push(`Experience: ${profile.years_experience} years`);
    if (profile.target_roles?.length) bits.push(`Wants: ${profile.target_roles.join(", ")}`);
    if (profile.preferred_cities?.length)
      bits.push(`Cities: ${profile.preferred_cities.join(", ")}`);
    if (profile.open_to_remote) bits.push("Open to remote");
    if (profile.expected_ctc) bits.push(`Expects: ₹${(profile.expected_ctc / 100000).toFixed(1)}L`);
    if (profile.notice_period_days !== null)
      bits.push(`Notice period: ${profile.notice_period_days} days`);
    lines.push(bits.length ? bits.join("\n") : "Profile is empty.");
  } else {
    lines.push("No profile on file.");
  }

  if (resume) {
    lines.push(
      `\nResume: ${resume.file_name ?? "uploaded"}, ATS score ${resume.ats_score ?? "unscored"} out of 100.`,
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
        `- ${j.title} at ${j.company} (${where}${years}${pay})${
          j.skills.length ? ` — ${j.skills.slice(0, 6).join(", ")}` : ""
        }`,
      );
    }
  }

  return lines.join("\n");
}
