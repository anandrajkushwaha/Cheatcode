import "server-only";
import { getPrimaryDraft, getPrimaryResume, getProfile, type Profile, type ResumeDraft } from "@/lib/app/account";
import { seedFromResume } from "@/lib/app/resume-draft";
import { cleanResume, resumeIsEmpty, type Resume } from "@/lib/app/resume-schema";
import type { Candidate } from "@/lib/jobs/match";

/**
 * Who is applying: the resume they are working on (or the one they
 * uploaded), and the profile around it. One loader, so the score on the card
 * and the application pack read the same person.
 */
export type Applicant = {
  resume: Resume | null;
  draft: ResumeDraft | null;
  profile: Profile | null;
  candidate: Candidate;
};

export async function getApplicant(): Promise<Applicant> {
  const [draft, uploaded, profile] = await Promise.all([getPrimaryDraft(), getPrimaryResume(), getProfile()]);
  const fromDraft = draft?.content && !resumeIsEmpty(cleanResume(draft.content)) ? cleanResume(draft.content) : null;
  const resume = fromDraft ?? (uploaded || profile ? seedFromResume(uploaded, profile) : null);
  const usable = resume && !resumeIsEmpty(resume) ? resume : null;

  return {
    resume: usable,
    draft,
    profile,
    candidate: {
      skills: usable?.skills ?? [],
      text: usable ? resumeText(usable).toLowerCase() : "",
      years: usable?.years_experience ?? profile?.years_experience ?? null,
      cities: profile?.preferred_cities?.length ? profile.preferred_cities : profile?.city ? [profile.city] : [],
      remote: Boolean(profile?.open_to_remote),
      targetRole: usable?.target_role ?? profile?.target_roles?.[0] ?? profile?.current_title ?? null,
    },
  };
}

/** Everything the resume says, as one string. */
export function resumeText(r: Resume): string {
  return [
    r.headline,
    r.summary,
    r.target_role,
    r.skills.join(", "),
    ...r.roles.flatMap((x) => [x.title, x.company, ...x.highlights]),
    ...r.projects.flatMap((p) => [p.name, p.description, ...(p.highlights ?? [])]),
    ...r.education.flatMap((e) => [e.degree, e.institution]),
    ...r.certifications,
    ...r.achievements,
  ]
    .filter(Boolean)
    .join("\n");
}
