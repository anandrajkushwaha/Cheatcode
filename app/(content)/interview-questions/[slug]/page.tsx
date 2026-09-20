import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Breadcrumbs } from "@/components/content/bits";
import { SITE } from "@/lib/seo/constants";
import { getBank, getPublishedBanks } from "@/lib/interview/bank";

export const revalidate = 3600;

export async function generateStaticParams() {
  const banks = await getPublishedBanks();
  return banks.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bank = await getBank(slug);
  if (!bank) {
    return buildMetadata({
      title: "Not found | Cheatcode",
      description: "That page does not exist.",
      path: `/interview-questions/${slug}`,
    });
  }

  return buildMetadata({
    title: `${bank.items.length} ${bank.role} Interview Questions and Answers | Cheatcode`,
    description:
      bank.intro?.slice(0, 155) ??
      `${bank.items.length} interview questions asked for ${bank.role} roles in India, with answers written the way a strong candidate would give them.`,
    path: `/interview-questions/${bank.slug}`,
  });
}

/**
 * One role's question page.
 *
 * Every answer is on the page as text rather than behind an accordion that
 * only fills in on click: an answer a crawler cannot see is an answer that
 * does not rank, and hiding half a page from somebody who arrived from Google
 * to read it is a poor trade for a tidier screen.
 *
 * The FAQPage JSON-LD is real structured data about content that is genuinely
 * on the page, which is the only version of it that is safe to ship.
 */
export default async function QuestionBankPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bank = await getBank(slug);
  if (!bank) notFound();

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: bank.items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />

      <Breadcrumbs
        items={[
          { href: "/interview-questions", label: "Interview questions" },
          { label: bank.role },
        ]}
      />

      <h1 className="mt-6 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
        {bank.items.length} {bank.role} interview questions and answers
      </h1>

      {bank.intro && (
        <p className="mt-5 max-w-[68ch] text-[0.98rem] leading-relaxed text-ink-70">
          {bank.intro}
        </p>
      )}

      <div className="mt-12 space-y-10">
        {bank.items.map((item, i) => (
          <section key={i}>
            <h2 className="text-[1.05rem] font-semibold leading-snug tracking-[-0.02em]">
              {i + 1}. {item.question}
            </h2>
            <p className="mt-3 max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-70">
              {item.answer}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-16 rounded-2xl border border-ink-08 p-6">
        <p className="text-[1.05rem] font-semibold tracking-[-0.02em]">
          Now try answering them out loud
        </p>
        <p className="mt-2 max-w-[58ch] text-[0.9rem] leading-relaxed text-ink-50">
          Reading a good answer and giving one are different skills. Cheatcode
          runs a mock interview on the {bank.role.toLowerCase()} job you are
          actually applying to, then tells you what to change — quoting your
          own answers back to you.
        </p>
        <Link
          href="/signin?next=/studio/interviews"
          className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-[0.9rem] font-medium text-paper transition-opacity hover:opacity-90"
        >
          Try a free mock interview
        </Link>
      </div>

      <p className="mt-10 text-[0.8rem] text-ink-30">
        More roles at{" "}
        <Link href="/interview-questions" className="underline underline-offset-4 hover:text-ink">
          {SITE.url.replace(/^https?:\/\//, "")}/interview-questions
        </Link>
        .
      </p>
    </>
  );
}
