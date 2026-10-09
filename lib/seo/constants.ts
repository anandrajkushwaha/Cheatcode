/**
 * The one host the site is served from: cheatcodeapp.com, no www.
 *
 * Search Console showed Google holding two copies of most pages, one on www
 * and one without, and 126 URLs reported as "Page with redirect": the
 * canonicals and the sitemap were naming a host that redirects. Whatever the
 * environment says, a www form of the production host is folded back here,
 * so every canonical, sitemap entry and JSON-LD URL names the page that
 * actually answers with a 200.
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://cheatcodeapp.com")
  .replace(/\/+$/, "")
  .replace(/^https?:\/\/www\.cheatcodeapp\.com$/i, "https://cheatcodeapp.com");

export const SITE = {
  name: "Cheatcode",
  url: SITE_URL,
  tagline: "The unfair advantage for your first few years.",
  description:
    "Cheatcode is the career toolkit for students and early-career professionals in India — a free resume builder with an ATS check, job search across company boards, AI mock interviews and a career agent that has read your resume.",
  locale: "en_IN",
  /**
   * The brand's own profiles and inbox. One copy, read by the footer and by
   * the Organization markup, so the entity Google sees and the links a
   * visitor sees can never describe two different companies.
   */
  email: "cheatcodeapp26@gmail.com",
  sameAs: [
    "https://www.instagram.com/cheatcodeapp/",
    "https://www.linkedin.com/company/cheatcodeapp/",
  ],
} as const;
