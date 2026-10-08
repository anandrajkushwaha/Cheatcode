import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { LegalPage, LegalSummary } from "@/components/content/LegalPage";

/**
 * About Cheatcode.
 *
 * The footer's "About Us" pointed at the homepage for want of this page. It
 * says what the product is, laid out the way the product is — build, find,
 * prepare, understand, get ahead — and links each claim to the page that
 * proves it. No founders, user counts or press logos: none of those are in
 * the codebase to stand behind, and an About page that invents them is worse
 * than one that leaves them out. Add them here when they are real.
 */

const UPDATED = "8 October 2026";

export const metadata: Metadata = buildMetadata({
  title: "About Cheatcode — India's early-career platform",
  description:
    "Cheatcode helps students and early-career professionals in India build a resume, find private and government jobs, prepare for interviews and understand their pay. What we do and how to reach us.",
  path: "/about",
});

const LAYERS: { name: string; blurb: string; links: { href: string; label: string }[] }[] = [
  {
    name: "Build",
    blurb: "A resume that gets read — by the software first and by a person second.",
    links: [
      { href: "/tools/resume-ats-checker", label: "Free ATS resume checker" },
      { href: "/signin?next=/app/resume", label: "Resume builder and templates" },
    ],
  },
  {
    name: "Find",
    blurb:
      "Private jobs from company boards, and government recruitments linked to the official notification.",
    links: [
      { href: "/jobs", label: "Private jobs" },
      { href: "/government-jobs", label: "Government jobs" },
    ],
  },
  {
    name: "Prepare",
    blurb: "Practice the interview before the one that counts.",
    links: [
      { href: "/interview-questions", label: "Interview questions" },
      { href: "/signin?next=/app/interviews", label: "AI mock interviews" },
    ],
  },
  {
    name: "Understand",
    blurb: "What an offer is worth, and what is changing in hiring.",
    links: [
      { href: "/tools/in-hand-salary-calculator", label: "In-hand salary calculator" },
      { href: "/insights", label: "Insights" },
      { href: "/blog", label: "Guides" },
    ],
  },
  {
    name: "Get ahead",
    blurb: "A career agent that has read your resume, and people who have done the job.",
    links: [
      { href: "/signin?next=/app/agent", label: "Career agent" },
      { href: "/become-a-mentor", label: "Become a mentor" },
    ],
  },
];

export default function AboutPage() {
  return (
    <>
      <LegalPage
        title="About Cheatcode"
        intro="Some people start their career with a cousin at Google. Cheatcode is for everybody else — students and early-career professionals in India."
        updated={UPDATED}
      >
        <LegalSummary>
          <p>{SITE.description}</p>
          <p>
            The free tools need no account. The resume builder, mock interviews and career agent
            need one, and some features are part of Cheatcode Pro.
          </p>
        </LegalSummary>

        <h2>What Cheatcode does</h2>
        <p>
          The first few years of a career are a handful of decisions made with very little
          information: which jobs to apply for, how to get a resume past the software that screens
          it, how to prepare for an interview, and whether an offer is any good. Cheatcode puts the
          tools and the information for each of those decisions in one place.
        </p>

        {LAYERS.map((l) => (
          <section key={l.name}>
            <h3>{l.name}</h3>
            <p>{l.blurb}</p>
            <ul>
              {l.links.map((x) => (
                <li key={x.href}>
                  <Link href={x.href}>{x.label}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <h2>How we publish</h2>
        <p>
          Government job pages link to the recruiting authority&apos;s own notification and show
          only the facts that notification states. Cheatcode is not a government body and never
          takes an application or a fee on anybody&apos;s behalf. The rules we hold every page to
          are written down in our <Link href="/editorial-standards">editorial standards</Link>.
        </p>

        <h2>Contact</h2>
        <p>
          Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> — for a correction, a question
          about your account, or anything else. We are also on{" "}
          <a href={SITE.sameAs[1]} rel="me noopener">
            LinkedIn
          </a>{" "}
          and{" "}
          <a href={SITE.sameAs[0]} rel="me noopener">
            Instagram
          </a>
          .
        </p>
      </LegalPage>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          url: `${SITE.url}/about`,
          name: "About Cheatcode",
          mainEntity: { "@id": `${SITE.url}/#organization` },
        }}
      />
      <JsonLd data={breadcrumbJsonLd([{ label: "Home", path: "/" }, { label: "About Cheatcode", path: "/about" }])} />
    </>
  );
}
