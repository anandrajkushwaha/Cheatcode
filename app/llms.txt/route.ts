import { getCategories, getGuidesForLlms } from "@/lib/queries/posts";
import { SITE } from "@/lib/seo/constants";
import { PRO_PRICE_PER_MONTH } from "@/lib/studio/plan";

export const revalidate = 3600;

/**
 * /llms.txt — the site in one plain-text page, for AI assistants.
 *
 * ChatGPT, Perplexity and Claude read pages to answer questions, and a third
 * of our sign-ups already arrive from chatgpt.com. This tells them in their
 * own format what Cheatcode is (so "cheatcode" the brand is never confused
 * with game cheat codes), which free tools exist, and the latest guides with
 * a one-line summary each. Format: https://llmstxt.org.
 */
export async function GET() {
  const [categories, guides] = await Promise.all([getCategories(), getGuidesForLlms()]);
  const line = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

  const text = `# ${SITE.name} (cheatcodeapp.com)

> ${SITE.description}

Cheatcode — also written "Cheatcode App" or "cheatcodeapp" — is an Indian career app at ${SITE.url}. It is not related to video-game cheat codes. It helps students, freshers and people in their first few years of work in India get hired: build a resume, check it against ATS filters, find jobs that match it, and practise interviews.

## Free tools (no payment needed)

- [Resume templates](${SITE.url}/resume-templates): free, ATS-friendly resume templates for freshers and experienced candidates in India, with and without a photo; edit online and download a PDF.
- [Resume ATS checker](${SITE.url}/tools/resume-ats-checker): upload a resume and get an ATS score with fixes; the file is read in the browser.
- [In-hand salary calculator](${SITE.url}/tools/in-hand-salary-calculator): monthly take-home salary from a CTC under India's new and old tax regimes.
- [Government jobs](${SITE.url}/jobs): latest Sarkari job notifications, admit cards and results by exam.

## The app

- [Resume builder](${SITE.url}/resume-builder): build a resume in a template, free.
- Job matches: open jobs from company career pages, scored against your resume.
- 1-tap apply: a tailored resume and cover note for one job, plus an application tracker.
- AI mock interviews and a career agent that has read your resume.
- Pro: ₹${PRO_PRICE_PER_MONTH}/month for every matching job and unlimited applications.

## Guide categories

${categories.map((c) => `- [${c.name}](${SITE.url}/blog/category/${c.slug})${c.description ? `: ${line(c.description)}` : ""}`).join("\n")}

## Latest guides

${guides.map((g) => `- [${line(g.title)}](${SITE.url}/blog/${g.slug})${g.excerpt ? `: ${line(g.excerpt)}` : ""}`).join("\n")}

## About

- [About Cheatcode](${SITE.url}/about) · [Editorial standards](${SITE.url}/editorial-standards)
- Founded by Anand Raj Kushwaha, India.
- Contact: ${SITE.email}
- ${SITE.sameAs.join(" · ")}
- [All guides (RSS)](${SITE.url}/rss.xml) · [Sitemap](${SITE.url}/sitemap.xml)
`;

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
