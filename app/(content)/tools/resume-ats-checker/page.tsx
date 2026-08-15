import Link from "next/link";
import type { Metadata } from "next";
import { AtsChecker } from "@/components/tools/AtsChecker";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd } from "@/lib/seo/jsonld";
import { FaqBlock } from "@/components/content/FaqBlock";
import { Breadcrumbs } from "@/components/content/bits";

export const revalidate = 86400;

const FAQ = [
  {
    q: "What is a good ATS score?",
    a: "Above 85 means nothing structural is standing between your resume and a recruiter. Between 70 and 85 the resume parses fine but the writing is leaving marks on the table. Below 50 usually means something is being lost entirely — a two-column layout, an image-based export, or missing section headings. Note that no applicant tracking system publishes a public score, so treat any number, including this one, as a checklist rather than a verdict.",
  },
  {
    q: "Does this upload my resume anywhere?",
    a: "No. The file is read inside your browser using JavaScript. It is never sent to our servers, never stored, and disappears the moment you close the tab. That is also why there is no signup — there is nothing to attach an account to.",
  },
  {
    q: "Why does my beautifully designed resume score badly?",
    a: "Most likely the two-column layout. Templates from Canva, Novoresume and similar tools put your skills and contact details in a sidebar. A parser reads across the full width of the page, line by line, so the sidebar gets spliced into the middle of your job descriptions and the result is unreadable. The design that impresses a person is often the one that defeats the software that sees it first.",
  },
  {
    q: "Should I send a PDF or a Word file?",
    a: "PDF, exported directly from Word or Google Docs, is the safest choice today. Every major ATS reads PDF reliably, and it preserves your formatting for the human at the end. Avoid the older .doc format, and never send a screenshot or an image-based export — that is the one case where a parser genuinely gets nothing.",
  },
  {
    q: "How many keywords should I include?",
    a: "Enough to be found, not enough to look strange. List 10–15 concrete tools, languages and frameworks in a Skills section, written the way job descriptions write them. Keyword stuffing, white text, and hidden keyword blocks are all detected and are a fast route to being rejected outright.",
  },
  {
    q: "Does a low score mean I will be rejected?",
    a: "No. It means you are making the process harder than it needs to be. Most of what this tool flags takes twenty minutes to fix, and the fixes are the same ones that make the resume easier for a human to read quickly.",
  },
];

export const metadata: Metadata = buildMetadata({
  title: "Free Resume ATS Checker — Real Score & Weak Points | Cheatcode",
  description:
    "Upload your resume and see what an ATS actually reads. Real parse-based score, plus the exact weak points costing you interviews. No signup, nothing uploaded.",
  path: "/tools/resume-ats-checker",
});

export default function AtsCheckerPage() {
  const url = `${SITE.url}/tools/resume-ats-checker`;

  return (
    <>
      <div className="container-page pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/tools", label: "Free tools" },
            { label: "Resume ATS checker" },
          ]}
        />

        <h1 className="mt-7 max-w-[20ch] text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05]">
          Resume ATS checker
        </h1>
        <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink-70">
          Before a person reads your resume, software does. Upload the file you
          are already sending and see what comes out the other side — the score,
          and the exact lines costing you it.
        </p>
        <p className="mt-4 text-[0.8rem] text-ink-30">
          Free · No signup · Runs entirely in your browser · Nothing uploaded
        </p>
      </div>

      <div className="container-page mt-12">
        <AtsChecker />
      </div>

      <div className="container-page mt-24 max-w-[68ch]">
        <div className="prose prose-cheatcode max-w-none">
          <h2>What this actually checks</h2>
          <p>
            An applicant tracking system does one job before anything else: it
            turns your file into plain text and tries to work out which part is
            your name, which part is a job, and when each job started. Everything
            downstream — the recruiter&apos;s search, the years-of-experience
            filter, the shortlist — runs on that extracted text. If extraction
            goes wrong, nothing else about your resume matters.
          </p>
          <p>
            So this tool reads your file the same way, and reports what came out.
            It measures the density of recoverable text per page, looks at where
            text sits on the page to detect side-by-side columns, checks whether
            standard section headings exist, and then reads the writing itself —
            bullet structure, opening verbs, quantified results, filler phrases,
            date formats and skills.
          </p>

          <h2>The honest limitation</h2>
          <p>
            No ATS publishes its scoring model. Workday, Taleo, Greenhouse and
            Lever all parse differently, and any tool claiming to return your
            &ldquo;real&rdquo; score from one of them is guessing. What is
            genuinely knowable is the other half of the problem: the things that
            reliably break a parser, and the things that leave a recruiter with
            nothing to hold on to. That is what the number here reflects — a
            checklist made measurable, not a peek inside someone&apos;s software.
          </p>

          <h2>The one that catches almost everyone</h2>
          <p>
            The two-column template. Skills and contact details in a narrow
            sidebar, experience in a wide main column. It looks considered, and it
            is the single most common reason a strong resume scores badly. A
            parser reads across the full width of the page, so line one becomes
            your name followed by the word Python, and line eight becomes half a
            job title followed by AWS. The text is all there; the meaning is gone.
          </p>

          <h2>What to do with a low score</h2>
          <p>
            Work down the red items in order, then the amber ones. Almost all of
            them are twenty minutes of work: move to a single column, add plain{" "}
            <em>Experience</em>, <em>Education</em> and <em>Skills</em> headings,
            put a number on half your bullets, and start each bullet with a verb.
            None of this requires new achievements — only that the ones you
            already have survive the trip.
          </p>
          <p>
            If you want the version that rewrites the lines for you rather than
            listing them,{" "}
            <Link href="/#waitlist">that is what we are building next</Link>.
          </p>
        </div>

        <FaqBlock items={FAQ} />
      </div>

      <JsonLd data={faqJsonLd(FAQ)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Resume ATS Checker",
          url,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          description:
            "Free resume ATS checker. Upload a resume and get a parse-based ATS score with the specific weak points to fix. Runs in the browser; nothing is uploaded.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
        }}
      />
    </>
  );
}
