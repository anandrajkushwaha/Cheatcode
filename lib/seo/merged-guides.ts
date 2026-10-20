/**
 * Guides folded into a stronger page on the same topic, old slug → new.
 *
 * next.config.ts 308s each old URL to the new one. The old rows are also
 * set noindex in the posts table (so they leave the sitemap, category pages
 * and related lists), and article bodies that still link an old slug are
 * pointed straight at the new one when rendered — an internal link that
 * goes through a redirect costs a crawl for nothing.
 *
 * A value starting with "/" is a full path (a tool page); otherwise it is
 * another guide's slug. mergedTarget() gives the path either way.
 *
 * Pure: no imports.
 */
export const MERGED_GUIDES: Record<string, string> = {
  "tell-me-about-yourself-interview-answer": "tell-me-about-yourself",
  "hr-interview-questions-freshers": "hr-interview-questions",
  "software-engineer-resume-format-freshers": "software-engineer-resume-format",
  "gratuity-calculation": "gratuity-calculation-india",
  "group-discussion-topics-tips": "group-discussion-topics-for-freshers",
  "how-to-calculate-in-hand-salary-from-ctc": "ctc-vs-in-hand-salary",
  "what-are-your-salary-expectations": "expected-ctc-question",
  "why-should-we-hire-you-answer": "why-should-we-hire-you",
  // Competed with the tool for "free ats resume checker" and with
  // what-is-a-good-ats-score for score meaning; Google crawled it and kept
  // neither (Search Console, Oct 2026).
  "free-ats-resume-checker": "/tools/resume-ats-checker",
};

/** Where a merged guide now lives, as a path. */
export function mergedTarget(slug: string): string | null {
  const to = MERGED_GUIDES[slug];
  if (!to) return null;
  return to.startsWith("/") ? to : `/blog/${to}`;
}
