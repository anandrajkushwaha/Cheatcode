/**
 * Which article categories get the resume offer instead of the mentor one.
 *
 * A list rather than a substring test on the slug. "resume" appears in
 * cover-letter articles constantly and in half the job-search ones, so
 * matching on the word would put a resume-builder pitch under a guide about
 * notice periods — and the only reason this block converts is that it is the
 * obvious next step from what was just read. That stops being true the moment
 * it is bolted onto everything.
 *
 * In its own module, not beside the component. `ResumeCta.tsx` is a Client
 * Component, and the blog page that has to answer "is this a resume article?"
 * is a Server Component deciding what to render. Reaching across that boundary
 * for a plain predicate is the kind of import that works until a build
 * changes its mind about it.
 */
const RESUME_CATEGORIES = new Set(["ats-resume", "resume-builder", "resume-format"]);

export function isResumeCategory(slug: string | null | undefined): boolean {
  return Boolean(slug && RESUME_CATEGORIES.has(slug));
}
