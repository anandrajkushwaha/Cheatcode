/**
 * Guides folded into a stronger page on the same topic, old slug → new.
 *
 * next.config.ts 308s each old URL to the new one. The old rows are also
 * set noindex in the posts table (so they leave the sitemap, category pages
 * and related lists), and article bodies that still link an old slug are
 * pointed straight at the new one when rendered — an internal link that
 * goes through a redirect costs a crawl for nothing.
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
};
