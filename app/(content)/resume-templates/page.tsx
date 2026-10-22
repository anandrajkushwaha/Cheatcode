import Link from "next/link";
import type { Metadata } from "next";
import { TemplatePicker } from "@/components/site/TemplatePicker";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd } from "@/lib/seo/jsonld";
import { FaqBlock } from "@/components/content/FaqBlock";
import { Breadcrumbs } from "@/components/content/bits";
import { FACETS, TEMPLATES } from "@/lib/app/resume-templates";

export const revalidate = 86400;

const COUNT = TEMPLATES.length;

const FAQ = [
  {
    q: "Are these resume templates really free?",
    a: `Yes. All ${COUNT} templates are free to use, edit and download as a PDF. You can start filling one in without an account; a free account is only needed to save your resume and download it.`,
  },
  {
    q: "Which resume template is best for ATS?",
    a: "A single-column template with plain section headings — Experience, Education, Skills. Applicant tracking systems read a page left to right, line by line, so a single column comes out in the right order every time. The Simple and Professional single-column designs here are the safest choice when you are applying through a job portal.",
  },
  {
    q: "Should I use a resume template with a photo?",
    a: "For most jobs in India, a photo is optional and many recruiters prefer none, because it takes space and adds nothing a shortlist depends on. It is still common for some roles — hospitality, front-office, modelling and some government and overseas applications ask for one. Use a photo template only when the job or the employer expects it.",
  },
  {
    q: "Can I change the template after I start?",
    a: "Yes, at any time. Your words stay exactly as they are and only the design changes, so you can try several templates on the same resume and keep the one that fits on one page.",
  },
  {
    q: "What format do I download my resume in?",
    a: "A PDF with real, selectable text — the format every major applicant tracking system reads reliably, and the one that looks the same on the recruiter's screen as on yours.",
  },
  {
    q: "Is one page enough for a fresher resume?",
    a: "Yes. A fresher or a candidate with under five years of experience should fit on one page. The builder shows the page count under the preview, so you can see the moment it runs onto a second page.",
  },
];

export const metadata: Metadata = buildMetadata({
  title: `Free Resume Templates — ${COUNT} ATS-Friendly Designs, PDF | Cheatcode`,
  description: `${COUNT} free resume templates for freshers and experienced professionals in India. Pick one, fill it in online with no sign-up to start, and download an ATS-friendly PDF.`,
  path: "/resume-templates",
});

export default function ResumeTemplatesPage() {
  const url = `${SITE.url}/resume-templates`;
  const byStyle = FACETS.style.map(({ value }) => ({
    style: value,
    names: TEMPLATES.filter((t) => t.style === value).map((t) => t.name),
  }));

  return (
    <>
      <div className="container-page pt-10 sm:pt-14">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Free resume templates" }]} />

        <h1 className="mt-7 max-w-[22ch] text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05]">
          Free resume templates
        </h1>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-ink-70">
          {COUNT} ATS-friendly designs for freshers and experienced professionals. Tap one and start
          typing — your resume builds beside the form, and you download it as a PDF.
        </p>
        <p className="mt-4 text-[0.8rem] text-ink-30">Free · No sign-up to start · Change the template any time</p>
      </div>

      <div className="container-page mt-10">
        <TemplatePicker />
      </div>

      <div className="container-page mt-24 max-w-[68ch]">
        <div className="prose prose-cheatcode max-w-none">
          <h2>How it works</h2>
          <ol>
            <li>
              <strong>Pick a template.</strong> Filter by style, colour, layout or the kind of role you are
              applying for.
            </li>
            <li>
              <strong>Fill it in.</strong> Personal details, summary, experience, education and skills, one
              section at a time, with the finished page updating as you type.
            </li>
            <li>
              <strong>Save and download.</strong> A free account keeps your resume, and the PDF is ready to
              send.
            </li>
          </ol>

          <h2>Which template should you choose?</h2>
          <p>
            Start from how the resume will be read. If you are applying through Naukri, LinkedIn or a
            company&apos;s careers page, software reads it first: choose a single-column design with plain
            headings, because a sidebar can be read across and mixed into your job descriptions. If a person
            reads it first — a referral, a startup founder, a design or content role — a sidebar, a header band
            or a timeline helps you stand out, and none of them costs you anything there.
          </p>
          <p>
            Not sure how yours will do? Run it through the free{" "}
            <Link href="/tools/resume-ats-checker">resume ATS checker</Link> once it is done. If you made a
            resume elsewhere before, see{" "}
            <Link href="/blog/canva-resume-ats-friendly">whether a Canva resume is ATS friendly</Link> or the{" "}
            <Link href="/blog/google-docs-resume-template">Google Docs resume templates ranked by ATS safety</Link>,
            and compare the <Link href="/blog/free-resume-builder">resume builders that are actually free</Link>.
          </p>

          <h2>All {COUNT} templates by style</h2>
          {byStyle.map((g) => (
            <section key={g.style}>
              <h3>
                {g.style} resume templates ({g.names.length})
              </h3>
              <p>{g.names.join(" · ")}</p>
            </section>
          ))}
        </div>

        <FaqBlock items={FAQ} />
      </div>

      <JsonLd data={faqJsonLd(FAQ)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Free Resume Templates and Builder",
          url,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          description: `${COUNT} free, ATS-friendly resume templates. Fill one in online and download a PDF.`,
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          publisher: { "@type": "Organization", name: SITE.name, url: SITE.url },
        }}
      />
    </>
  );
}
