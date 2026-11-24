import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/jsonld";
import { FaqBlock } from "@/components/content/FaqBlock";
import { Breadcrumbs } from "@/components/content/bits";
import { ResumeTemplates } from "@/components/site/ResumeTemplates";
import { BuilderReturn } from "@/components/site/BuilderReturn";
import { TEMPLATES } from "@/lib/app/resume-templates";

/**
 * /resume-builder — the public page for "resume builder" and "CV maker".
 *
 * Until Release A this URL *was* the editor, marked noindex, so the site's
 * most valuable commercial query had no page that could rank, and
 * /resume-templates carried the "Free Resume Builder" title instead. The
 * editor now lives at /resume-builder/create (noindex); every button here
 * leads there, and an old /resume-builder?template=id link is sent there by
 * a 308 in next.config.ts, so no template link broke.
 *
 * Every claim on this page is something the product does today: the 60
 * templates, the live preview, the design controls, the guest start, the
 * PDF without a watermark, the ATS checker's one free check a day. Nothing
 * here says "AI" — the free builder has no AI writing — and the PDF is A4.
 */

export const revalidate = 86400;

const COUNT = TEMPLATES.length;
const PATH = "/resume-builder";
const CREATE = "/resume-builder/create";

const FAQ = [
  {
    q: "Is the resume builder really free?",
    a: `Yes. Building your resume, all ${COUNT} templates and the PDF download cost nothing, and the PDF carries no watermark. Cheatcode Pro — the career agent and AI mock interviews — is optional and separate.`,
  },
  {
    q: "Do I need an account to make a resume?",
    a: "Not to start. You can fill in your whole resume first; it is kept in your browser while you write. You sign in only when you download, so the resume is saved to your account and you can edit it later.",
  },
  {
    q: "Are the templates ATS-friendly?",
    a: "They are built from real, selectable text with clear section headings, which is what applicant tracking systems read. For portal applications, a single-column template is the safest choice. You can check the finished file with the ATS checker — one check a day is free.",
  },
  {
    q: "Can I make a CV instead of a resume?",
    a: "Yes. In the UK, Ireland, India, the UAE and much of Europe, \"CV\" is the everyday word for the same one-to-two-page document. Use any template, call it your CV, include the sections employers in your country expect, and download it.",
  },
  {
    q: "What file do I get?",
    a: "A PDF with real, selectable text, on A4 paper. It looks the same on the recruiter's screen as it does on yours.",
  },
  {
    q: "Can I change the template after I start?",
    a: "Yes, at any time. Your words stay as they are and only the design changes, so you can try several templates on the same resume.",
  },
];

export const metadata: Metadata = buildMetadata({
  title: `Free Resume Builder & CV Maker – ${COUNT} ATS-Friendly Templates`,
  description: `Build your resume or CV free in ${COUNT} ATS-friendly templates. No sign-up to start, and download a PDF with no watermark. Then check it with our ATS checker.`,
  path: PATH,
});

const primary =
  "inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-[0.95rem] font-medium text-paper transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]";
const secondary =
  "inline-flex items-center justify-center rounded-full border border-ink-15 px-6 py-3 text-[0.95rem] font-medium transition-colors hover:border-ink";

const STEPS = [
  {
    t: "Choose a template",
    d: `Pick one of ${COUNT} designs — filter by style, colour, layout or the kind of role you are applying for.`,
  },
  {
    t: "Fill in your details",
    d: "Experience, education, skills and projects, one section at a time. The finished page updates beside the form as you type.",
  },
  {
    t: "Download your PDF",
    d: "Sign in at this step so your resume is saved, and the PDF downloads straight away — no watermark.",
  },
];

const FEATURES = [
  { t: `${COUNT} templates`, d: "Simple, professional, modern and creative designs, with and without a photo, matched to the roles they suit." },
  { t: "Live preview", d: "See the real page as you write, with a page count, so you know the moment it runs onto a second page." },
  { t: "Design controls", d: "Change the accent colour, typeface, text size and spacing, or add a photo — without retyping anything." },
  { t: "No watermark", d: "The PDF you download is clean, with real, selectable text that applicant tracking systems can read." },
  { t: "Start without an account", d: "Write first. Your draft stays in your browser until you sign in to download it." },
  { t: "ATS check when you finish", d: "Run the finished resume through the ATS checker to see what screening software reads. One check a day is free." },
];

export default function ResumeBuilderPage() {
  const url = `${SITE.url}${PATH}`;
  return (
    <>
      <BuilderReturn />

      {/* Hero */}
      <div className="container-page pt-10 sm:pt-14">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Resume builder" }]} />
        <h1 className="mt-7 max-w-[18ch] text-[clamp(2.2rem,5vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
          Free resume builder
        </h1>
        <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-ink-70">
          Pick a template, fill in your details and download a clean PDF. Works for a resume or a CV — and
          there is no sign-up until you download.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={CREATE}
            rel="nofollow"
            data-ev="cta_click"
            data-ev-location="resume-builder-hero"
            data-ev-label="Build my resume"
            className={primary}
          >
            Build my resume — free
          </Link>
          <Link
            href="/resume-templates"
            data-ev="cta_click"
            data-ev-location="resume-builder-hero"
            data-ev-label="Browse templates"
            className={secondary}
          >
            Browse {COUNT} templates
          </Link>
        </div>
        <p className="mt-4 text-[0.8rem] text-ink-30">Free · No watermark · No sign-up to start</p>
      </div>

      {/* Template previews: the real documents, each opening the editor in that design. */}
      <ResumeTemplates where="resume-builder" heading="Start from a template." />

      <div className="container-page max-w-[68ch]">
        <div className="prose prose-cheatcode max-w-none">
          <h2>Build a resume in three steps</h2>
          <ol>
            {STEPS.map((s) => (
              <li key={s.t}>
                <strong>{s.t}.</strong> {s.d}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <section className="container-page mt-20" aria-labelledby="features">
        <h2 id="features" className="text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-[-0.03em]">
          What you get, free
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.t} className="rounded-2xl border border-ink-08 p-6">
              <p className="text-[1rem] font-semibold">{f.t}</p>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-50">{f.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="container-page mt-20 max-w-[68ch]">
        <div className="prose prose-cheatcode max-w-none">
          <h2>Resume builder or CV maker: which do you need?</h2>
          <p>
            The same tool, two names. In the United States and Canada, a <strong>resume</strong> is a one- to
            two-page summary of your experience, tailored to the job. In the United Kingdom, Ireland, India,
            the UAE and much of Europe, people call that same document a <strong>CV</strong>. A longer academic
            CV — every publication, talk and grant — is the one real exception, and it is mostly asked for in
            research and university hiring.
          </p>
          <p>
            So whichever word your employer uses, this builder makes it: choose a template, add the sections
            recruiters in your country expect, and download the PDF. If you are unsure which to send, read{" "}
            <Link href="/blog/resume-vs-cv">resume vs CV: the difference</Link>.
          </p>

          <h2>After you build it</h2>
          <ul>
            <li>
              Check what screening software reads with the{" "}
              <Link href="/tools/resume-ats-checker">resume ATS checker</Link> — one free check a day.
            </li>
            <li>
              See every design side by side in the <Link href="/resume-templates">resume templates</Link>{" "}
              gallery.
            </li>
            <li>
              Follow a <Link href="/blog/category/resume-format">resume format guide</Link> for your role.
            </li>
            <li>
              Find openings that match your resume in <Link href="/jobs">jobs</Link>.
            </li>
          </ul>
        </div>

        <FaqBlock items={FAQ} />
      </div>

      {/* Final CTA */}
      <section className="container-page my-24">
        <div className="rounded-3xl bg-ink px-8 py-12 text-paper sm:px-14 sm:py-16">
          <h2 className="max-w-[20ch] text-[clamp(1.7rem,3.5vw,2.6rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
            Your next application starts here.
          </h2>
          <p className="mt-4 max-w-[48ch] text-[1rem] leading-relaxed text-paper/70">
            {COUNT} free templates, a live preview and a clean PDF. No sign-up until you download.
          </p>
          <Link
            href={CREATE}
            rel="nofollow"
            data-ev="cta_click"
            data-ev-location="resume-builder-footer"
            data-ev-label="Build my resume"
            className="mt-8 inline-flex rounded-full bg-paper px-6 py-3 text-[0.95rem] font-medium text-ink transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]"
          >
            Build my resume — free
          </Link>
        </div>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Cheatcode Resume Builder",
          url,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: `Free online resume builder and CV maker with ${COUNT} ATS-friendly templates, a live preview and PDF download without a watermark.`,
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
        }}
      />
      <JsonLd data={breadcrumbJsonLd([{ label: "Home", path: "/" }, { label: "Resume builder", path: PATH }])} />
      <JsonLd data={faqJsonLd(FAQ)} />
    </>
  );
}
