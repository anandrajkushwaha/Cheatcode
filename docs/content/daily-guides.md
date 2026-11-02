# Daily guides: how the scheduled writer works

Two new guides go live on cheatcodeapp.com every day. A scheduled Claude
session follows this file from top to bottom. Each guide has to be good
enough to be the page Google ranks and ChatGPT, Perplexity or Google's AI
Overview quotes. If a guide can't meet that bar, publish fewer. Never fill
the quota with a weak one.

Database: the Supabase project `yosbzjjsmalnvuvyadar` (Cheatcode). It is
never `sxpieiecudkquhyryjwg`, which is a different product.

## 1. Pick two topics

First, read what already exists so nothing is written twice:

```sql
select slug, title, focus_keyword, c.slug as category
from posts p left join categories c on c.id = p.category_id
where status = 'published' order by published_at desc;
```

Also read `lib/seo/merged-guides.ts`. A slug listed there redirects to
another page, so never reuse one.

Choose topics that:

- Are a question a student, fresher or early-career person in India types
  into Google or asks ChatGPT. Use the words they use, e.g. "resume format
  for freshers pdf", "notice period rules India", "TCS NQT syllabus 2026".
- Are not already covered. That means no slug or focus keyword means the
  same thing. A different angle is fine: "Java developer resume format" can
  sit next to "software engineer resume format". Another "how to make a
  resume" is not fine.
- Sit next to what Bing's AI answers (which feed ChatGPT and Copilot)
  already cite us for. Bing Webmaster, AI Performance, Nov 2026, most cited first:
  - EPF and PF: balance check (missed call, SMS, UMANG, passbook), interest
    rate, PF transfer, wage ceiling, withdrawal, grievance
  - letters: resignation, relieving (including how to get one from a
    specific employer), offer vs appointment, experience, internship
    certificate
  - in-hand salary: improve the existing guides and the calculator. Never
    add new one-package pages, which were merged for being near-duplicates
  - interview answers (strengths, weakness, technical questions for freshers)
  - fresher resume formats by role
  - Canva resumes and ATS. Bing search shows dozens of "is canva ats
    friendly" variations.
  New angles on these compound what already works. Google sends almost
  nothing yet; Bing and ChatGPT are where these guides get read.
- Use two different categories on the same day.

Category slugs: `ats-resume`, `resume-builder`, `resume-format`,
`cover-letter`, `ai-job-search`, `mentorship`, `interview-prep`, `salary`,
`linkedin`, `job-search`, `government-jobs-exams`, `pf-tax`,
`letters-formats`, `career-growth`.

## 2. Research before writing

- Every fact that can be checked is checked against an official or primary
  source: EPFO, the Income Tax Department, the Labour Ministry, SSC, UPSC,
  IBPS, a company's own careers page, NASSCOM, AICTE, government gazettes.
  Search the web for it.
- Never invent a number, a salary figure, a survey, a quote, a person or an
  experience ("I hired 200 freshers…"). When a figure varies, give the range
  and say what it depends on. When you can't verify a fact, leave it out.
- Dates matter: write for the current year, and say "as of <month year>"
  next to anything that changes (exam dates, tax slabs, PF rate).

## 3. Write it

Shape, in this order:

1. **excerpt**: 2–3 sentences that answer the title's question directly.
   The real number, step or verdict comes first, and there is no "In this
   article…". It is shown under the H1 and marked as the answer for AI
   engines. At least 120 characters.
2. **Body HTML**, 1,400–2,200 words, made only of `h2`, `h3`, `p`, `ul`,
   `ol`, `li`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `strong`, `em`,
   `a` and `blockquote`. No `h1`, because the page adds it. No inline styles.
   - H2s are phrased the way people ask: "What is the notice period in India?",
     "How to write a fresher resume with no experience".
   - Each section opens with its answer in the first sentence, then explains.
   - At least one table: a comparison, format, salary range, timeline or
     checklist.
   - Use real examples written for India: Indian names, cities, colleges,
     companies and ₹ figures.
   - A short "Sources" section at the end, linking the official pages you
     used. Use full `https://` links.
3. **Internal links**, at least 3 and ideally 5, written as
   `<a href="/blog/<slug>">natural anchor text</a>`. Point them at existing
   guides from the list in step 1 where they truly help the reader. Add one
   tool link where it fits: `/resume-templates` (free resume builder),
   `/tools/resume-ats-checker` or `/tools/in-hand-salary-calculator`. Never
   link to a slug you didn't see in the query. Links back to this guide from
   older ones happen on their own: every guide's focus keyword becomes a link
   wherever it appears in other guides.
4. **faq**: 4–6 real follow-up questions, each with a 1–3 sentence answer.
   They also go in the body as a final `<h2>Frequently asked questions</h2>`
   with an `h3` per question.

Voice: plain English that a tier-3 college student reading on a phone
understands. Use short sentences, "you", and no fluff, hype or emoji.

## 4. Publish

Write each guide to a JSON file in the scratchpad:

```json
{
  "title": "Notice Period Rules in India: What the Law and Your Offer Letter Say",
  "slug": "notice-period-rules-india",
  "excerpt": "…2–3 sentence direct answer…",
  "content_html": "<h2>…</h2><p>…</p>…",
  "category": "letters-formats",
  "seo_title": "≤ 60 characters, keyword first",
  "seo_description": "≤ 155 characters, the answer plus why click",
  "focus_keyword": "notice period rules india",
  "secondary_keywords": ["…", "…"],
  "faq": [{ "q": "…", "a": "…" }],
  "related_tool_slugs": ["resume-ats-checker"]
}
```

`related_tool_slugs` takes `resume-ats-checker` or
`in-hand-salary-calculator`, or leave it empty.

Then turn it into SQL. The script cleans the HTML exactly as the admin
editor does. It refuses a guide that is under 900 words, has a short
excerpt, has fewer than 3 guide links, or uses a merged slug.

```sh
node --experimental-strip-types --no-warnings --import ./scripts/alias-hook.mjs \
  scripts/post-sql.ts /path/to/guide.json > /path/to/guide.sql
```

Before running the SQL, check the slug is free:
`select 1 from posts where slug = '<slug>'`. Then run the file's SQL with
the Supabase tool. It returns the slug.

Finally, check that both rows are live:

```sql
select slug, status, word_count, published_at from posts
where published_at > now() - interval '1 hour';
```

The site picks the guides up within minutes. The sitemap refreshes every
10 minutes, and the daily IndexNow run (11:11 IST) tells Bing, which feeds
ChatGPT search.

## 5. Report

End with one line per guide: title, `/blog/<slug>`, word count, and the
guides it links to. When fewer than two guides were published, say why.
