import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { LegalPage, LegalSummary } from "@/components/content/LegalPage";

/**
 * Editorial standards.
 *
 * The rules every public page is written to, stated where a reader (and a
 * search quality rater) can check us against them. These are commitments, so
 * each one has to stay true of the code: the government-jobs section restates
 * what app/(content)/government-jobs/[slug] already does — a fact is shown only
 * when `shown` holds it, the apply link is the authority's own, a withdrawn
 * listing says so. Change that behaviour and this page changes with it.
 */

const UPDATED = "8 October 2026";

export const metadata: Metadata = buildMetadata({
  title: "Editorial standards — Cheatcode",
  description:
    "How Cheatcode sources, writes, dates and corrects its guides, government job pages, Insights and research — and what we will never publish.",
  path: "/editorial-standards",
});

export default function EditorialStandardsPage() {
  return (
    <>
      <LegalPage
        title="Editorial standards"
        intro="People make career decisions on what they read here — which form to fill, which offer to take. These are the rules every page on Cheatcode is held to."
        updated={UPDATED}
      >
        <LegalSummary>
          <p>We do not invent facts, statistics, authors, reviews or credentials.</p>
          <p>
            Government job details come from the official notification, and the official link is
            always on the page. Where a detail is unclear, we leave it out rather than guess.
          </p>
          <p>
            A page&apos;s date changes only when its content does. Mistakes are corrected, and you
            can report one to <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
          </p>
        </LegalSummary>

        <h2>Government jobs and exams</h2>
        <ul>
          <li>
            Every recruitment page links to the recruiting authority&apos;s own notification or
            website. That document is the one to go by, and the page says so.
          </li>
          <li>
            Vacancies, dates, age limits, fees and eligibility are shown only when the notification
            states them plainly. Anything it does not state is left off the page, not estimated.
          </li>
          <li>
            Cheatcode is not a government body. We never take an application or a fee, and the
            apply button always opens the official site.
          </li>
          <li>
            When we cannot stand behind a listing, we withdraw it and say so on its page rather
            than leave it up.
          </li>
        </ul>

        <h2>Guides</h2>
        <ul>
          <li>Each guide answers the question it is titled with near the top.</li>
          <li>
            Every guide carries a byline that links to its{" "}
            <Link href="/authors/cheatcode-team">author page</Link>, and a published date. We
            do not change a page&apos;s date to make it look fresh — only to record a real change.
          </li>
          <li>
            Claims about law, tax, salary rules or eligibility are checked against a primary source
            — the statute, the department or the official notification — and that source is cited.
          </li>
        </ul>

        <h2>Insights</h2>
        <p>
          <Link href="/insights">Insights</Link> are short summaries of current developments in
          hiring, pay and work rules in India. Each one is based on a published report or article,
          which it names and links to wherever one exists. The morning set is summarised
          automatically from the sources it names, so the original is the one to rely on; an
          Insight that misreads its source is taken down when we find it or you report it.
        </p>

        <h2>Research and data</h2>
        <p>
          Any statistic presented as Cheatcode&apos;s own comes from Cheatcode&apos;s own data,
          and is published with its method, sample size, time period and limitations. We do not
          publish figures we cannot reproduce.
        </p>

        <h2>Comparisons</h2>
        <p>
          When we compare Cheatcode with another product, we use the same stated criteria for
          every product — who it is for, what it does, what it costs — and we review the
          comparison at least every six months, because products change.
        </p>

        <h2>AI-assisted writing</h2>
        <p>
          We use AI tools to help research and draft. Guides, government job pages and research
          are reviewed by a person before they are published; Insights, as above, are not, and
          say whose reporting they summarise. The standards on this page apply the same way
          whoever — or whatever — wrote the first draft.
        </p>

        <h2>Corrections</h2>
        <p>
          If something on Cheatcode is wrong, email{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> with the page and what is wrong. We fix
          factual errors as soon as we have confirmed them, and a correction to a substantive fact
          updates the page&apos;s date.
        </p>
      </LegalPage>

      <JsonLd
        data={breadcrumbJsonLd([
          { label: "Home", path: "/" },
          { label: "Editorial standards", path: "/editorial-standards" },
        ])}
      />
    </>
  );
}
