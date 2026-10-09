/**
 * The one host the site is served from: www.cheatcodeapp.com.
 *
 * Vercel serves the site on www and 308-redirects the bare domain to it.
 * Search Console listed 126 bare-domain URLs as "Page with redirect": the
 * canonicals and the sitemap were naming cheatcodeapp.com, which never
 * answers with a page. Whatever the environment says, either form of the
 * production host resolves to www here, so every canonical, sitemap entry
 * and JSON-LD URL names the URL that answers with a 200. (Chrome hides the
 * "www" in its address bar, which is why the site looks like it lives on
 * the bare domain; Search Console's redirect list is the reliable witness.)
 */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cheatcodeapp.com")
  .replace(/\/+$/, "")
  .replace(/^https?:\/\/(www\.)?cheatcodeapp\.com$/i, "https://www.cheatcodeapp.com");

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
