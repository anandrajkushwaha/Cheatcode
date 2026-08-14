import Link from "next/link";
import type { Metadata } from "next";
import { SalaryCalculator } from "@/components/tools/SalaryCalculator";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/seo/constants";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd } from "@/lib/seo/jsonld";
import { FaqBlock } from "@/components/content/FaqBlock";
import { Breadcrumbs } from "@/components/content/bits";
import { RATES_AS_OF } from "@/lib/tools/salary";

export const revalidate = 86400;

const FAQ = [
  {
    q: "Why is my in-hand salary so much lower than my CTC?",
    a: "CTC is what you cost your employer, not what you are paid. It includes the employer's PF contribution, a gratuity provision you only receive after five years, and often insurance premiums — none of which reach your bank account. On a typical ₹8 LPA offer, roughly ₹60,000–70,000 a year is employer-side cost before a single deduction is applied to your payslip.",
  },
  {
    q: "What percentage of CTC is usually in hand in India?",
    a: "For freshers on ₹4–8 LPA, take-home is commonly 78–88% of CTC. The ratio drops as CTC rises, because income tax becomes the dominant deduction. Above ₹15 LPA it is often closer to 65–72%.",
  },
  {
    q: "Should a fresher pick the new or old tax regime?",
    a: "For most freshers the new regime works out better, because it has a higher standard deduction and a rebate that makes income up to ₹12 lakh taxable at nil. The old regime only wins if you have substantial 80C investments, home loan interest, or a large HRA claim — which most people in their first year do not.",
  },
  {
    q: "Is the ₹15,000 PF ceiling applied by every employer?",
    a: "Most Indian employers cap the PF calculation at a basic of ₹15,000 a month, which fixes the contribution at ₹1,800. Some deduct 12% of your full basic instead, which raises your PF savings and lowers your take-home. Your payslip will tell you which one applies.",
  },
  {
    q: "Does this calculator store my salary?",
    a: "No. Every calculation runs in your browser. Nothing is sent to a server, nothing is stored, and there is no signup.",
  },
  {
    q: "Why does the calculator not include HRA exemption?",
    a: "HRA exemption depends on your actual rent, your city, and your basic — details this calculator does not ask for. Leaving it out means the figure it shows is a conservative floor. Your real take-home may be higher, which is the safer direction for a number you might plan around.",
  },
];

export const metadata: Metadata = buildMetadata({
  title: "In-Hand Salary Calculator (India) — CTC to Take-Home | Cheatcode",
  description:
    "Free in-hand salary calculator for India. Convert CTC to monthly take-home with PF, gratuity, professional tax and income tax. No signup, nothing stored.",
  path: "/tools/in-hand-salary-calculator",
});

export default function SalaryCalculatorPage() {
  const url = `${SITE.url}/tools/in-hand-salary-calculator`;

  return (
    <>
      <div className="container-page pt-10 sm:pt-14">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/tools", label: "Free tools" },
            { label: "In-hand salary calculator" },
          ]}
        />

        <h1 className="mt-7 max-w-[20ch] text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05]">
          In-hand salary calculator
        </h1>
        <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-ink-70">
          Put in the CTC from your offer letter. Get the number that will actually
          land in your bank account each month — with every deduction shown, so you
          can see exactly where the difference goes.
        </p>
        <p className="mt-4 text-[0.8rem] text-ink-30">
          Free · No signup · Runs entirely in your browser · {RATES_AS_OF}
        </p>
      </div>

      <div className="container-page mt-12">
        <SalaryCalculator />
      </div>

      <div className="container-page mt-24 max-w-[68ch]">
        <div className="prose prose-cheatcode max-w-none">
          <h2>What the calculator is actually doing</h2>
          <p>
            An Indian offer letter quotes <strong>Cost to Company</strong> — the total
            an employer spends on you in a year. Four things sit inside that number
            and never reach your account: the employer&apos;s 12% provident fund
            contribution, a gratuity provision you can only claim after five years of
            continuous service, any group insurance premium, and in many companies a
            variable or performance component that is paid annually rather than monthly.
          </p>
          <p>
            What remains is your <strong>gross salary</strong> — the figure printed at
            the top of your payslip. From that, three deductions come out every month:
            your own 12% PF contribution, professional tax (a state levy, typically
            ₹200 a month, and zero in Delhi, UP, Haryana and Rajasthan), and TDS on
            income tax.
          </p>

          <h2>A worked example: ₹8 LPA</h2>
          <p>
            Take a ₹8,00,000 CTC with basic set at 45%, in Karnataka, under the new
            tax regime. Basic is ₹3,60,000. The employer contributes ₹21,600 to PF
            (capped at the ₹15,000 monthly wage ceiling) and provisions ₹17,316 for
            gratuity. Gross salary is therefore about ₹7,61,000, not ₹8,00,000.
          </p>
          <p>
            From that gross, you lose ₹21,600 to your own PF, ₹2,400 to professional
            tax, and — after the ₹75,000 standard deduction, taxable income lands
            under the ₹12 lakh rebate threshold, so income tax is nil. Take-home works
            out near ₹61,000 a month. The number on the offer letter divided by twelve
            would have suggested ₹66,667.
          </p>

          <h2>Why the gap widens as your CTC grows</h2>
          <p>
            At ₹8 LPA, the rebate means you pay no income tax at all, so take-home is a
            high share of CTC. At ₹18 LPA the same structure hands a meaningful slice to
            tax, and take-home falls to roughly two-thirds of CTC. This is why comparing
            two offers on CTC alone is misleading — a job with a lower CTC but a smaller
            variable component can pay you more each month.
          </p>

          <h2>What to check on your own offer letter</h2>
          <ul>
            <li>
              <strong>Basic as a percentage of CTC.</strong> A lower basic means lower
              PF and slightly higher take-home now, but less retirement saving and a
              smaller gratuity later.
            </li>
            <li>
              <strong>Variable or performance pay.</strong> If it is inside CTC, it is
              not guaranteed. Ask what percentage of employees actually received the
              full amount last year.
            </li>
            <li>
              <strong>Joining or retention bonus.</strong> Often has a clawback clause
              if you leave within 12–24 months.
            </li>
            <li>
              <strong>Gratuity.</strong> Legally payable after five years of continuous
              service. If you are unlikely to stay that long, treat it as ₹0.
            </li>
          </ul>

          <h2>Related reading</h2>
          <p>
            For the full breakdown of what each payslip line means, read{" "}
            <Link href="/blog/ctc-vs-in-hand-salary">CTC vs in-hand salary</Link>. If
            you are still deciding whether to accept, our guide on{" "}
            <Link href="/blog/how-to-negotiate-salary">how to negotiate salary</Link>{" "}
            covers what to say and when. And before you resign anywhere, check the{" "}
            <Link href="/blog/notice-period-rules-india">notice period rules in India</Link>.
          </p>
        </div>

        <FaqBlock items={FAQ} />
      </div>

      <div className="h-24" />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "In-Hand Salary Calculator (India)",
          applicationCategory: "FinanceApplication",
          operatingSystem: "Web",
          url,
          description:
            "Convert an Indian CTC into monthly take-home pay, with PF, gratuity, professional tax and income tax broken out.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          inLanguage: "en-IN",
        }}
      />
      <JsonLd data={faqJsonLd(FAQ)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
            { "@type": "ListItem", position: 2, name: "Free tools", item: `${SITE.url}/tools` },
            { "@type": "ListItem", position: 3, name: "In-hand salary calculator", item: url },
          ],
        }}
      />
    </>
  );
}
