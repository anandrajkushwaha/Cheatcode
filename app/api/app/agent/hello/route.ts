import { getSessionUser } from "@/lib/supabase/app";
import { getProfile, getPrimaryResume } from "@/lib/app/account";
import { searchJobs } from "@/lib/jobs/query";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * The first thing the agent says, before anybody asks anything.
 *
 * Composed from the data rather than generated. A model call here would cost
 * money and half a second on every single open, to produce a sentence whose
 * only job is to prove it already knows who you are — and the facts it would
 * be told to say are exactly the four below. Writing them directly is faster,
 * free, and cannot hallucinate a score.
 *
 * It is written to be *spoken*: two sentences, no numbers said as digits
 * where a person would say them as words, and it ends on a question so the
 * silence afterwards is an invitation rather than a pause.
 */

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);

  const { jobs } = await searchJobs({
    cities: (profile?.preferred_cities ?? []).slice(0, 4),
    maxYears: profile?.years_experience ?? null,
    limit: 12,
  }).catch(() => ({ jobs: [] }));

  return Response.json({ ok: true, ...compose(profile, resume, jobs.length) });
}

type Profile = Awaited<ReturnType<typeof getProfile>>;
type Resume = Awaited<ReturnType<typeof getPrimaryResume>>;

/**
 * Two lines, not one.
 *
 * `heading` replaces the question on screen, so the surface greets by name
 * without a chat bubble appearing. `spoken` is what is said aloud, and it is
 * deliberately different: the screen already lists what to ask about, so the
 * spoken line spends its one sentence on what this thing can *do* — because
 * somebody hearing a voice for the first time does not yet know whether it
 * finds jobs, fixes resumes, or just talks.
 *
 * The first version made the greeting a message in the thread. That was
 * wrong: it turned the opening screen into a conversation before anybody had
 * said anything, and the orb — the whole reason the screen looks like that —
 * shrank away half a second after it appeared.
 */
function compose(profile: Profile, resume: Resume, openRoles: number) {
  // First name only. "Hi Anand Raj Kushwaha" is how a bank talks.
  const name = profile?.full_name?.trim().split(/\s+/)[0];
  const heading = name ? `Hey ${name}. What can I help with?` : "What can I help with?";
  const hey = name ? `Hey ${name}.` : "Hey.";

  // Nothing to work from. Say the one thing that would change that.
  if (!resume) {
    return {
      heading,
      spoken: `${hey} I can find jobs that fit you, read your resume and tell you what is weak in it, and help you fix it. Add a resume and I will start there.`,
    };
  }

  if (resume.parse_error || !resume.parsed) {
    return {
      heading,
      spoken: `${hey} I could not read your resume properly, but tell me what you do and I can still find jobs for you and help you fix it.`,
    };
  }

  const score = typeof resume.ats_score === "number" ? resume.ats_score : null;
  const scoreBit = score !== null ? ` Your resume scores ${score} out of a hundred.` : "";
  const jobBit =
    openRoles > 0
      ? ` There ${openRoles === 1 ? "is one role" : `are ${openRoles} roles`} open that fit you.`
      : "";

  return {
    heading,
    spoken:
      `${hey} I can find jobs that fit your resume, tell you what is weak in it, or help you fix it.` +
      `${scoreBit}${jobBit} What do you want to start with?`,
  };
}
