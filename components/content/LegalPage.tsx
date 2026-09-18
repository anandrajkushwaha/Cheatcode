import { Breadcrumbs } from "@/components/content/bits";

/**
 * The shell every legal page sits in.
 *
 * Three documents share it — privacy, terms, refunds — and they share it on
 * purpose. A person who lands on one of these is usually checking whether the
 * site is serious before handing over a resume or a card, and three pages that
 * look like three different sites answer that question badly.
 *
 * `updated` is rendered where a reader looks for it rather than buried at the
 * bottom: the date is the single most useful fact on a policy page, because it
 * tells you whether anyone has touched the document since the product changed.
 */
export function LegalPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="container-page pt-10 sm:pt-14">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: title }]} />

        <h1 className="mt-7 max-w-[20ch] text-[clamp(2rem,4.5vw,3.25rem)] font-semibold leading-[1.05]">
          {title}
        </h1>
        <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-ink-70">
          {intro}
        </p>
        <p className="mt-4 text-[0.8rem] text-ink-30">Last updated {updated}</p>
      </div>

      <div className="container-page mt-12 mb-28 max-w-[68ch]">
        <div className="prose prose-cheatcode max-w-none">{children}</div>
      </div>
    </>
  );
}

/**
 * A short, plain-language summary at the top of a policy.
 *
 * Nobody reads a policy end to end, so the honest thing is to put the answer
 * to the question they actually arrived with — what do you take, and what do
 * you do with it — above the section where the detail lives.
 */
export function LegalSummary({ children }: { children: React.ReactNode }) {
  return (
    <div className="not-prose rounded-2xl border border-ink-08 bg-ink-04 p-6 sm:p-7">
      <p className="text-[0.78rem] font-medium uppercase tracking-[0.08em] text-ink-30">
        The short version
      </p>
      <div className="mt-4 space-y-3 text-[0.95rem] leading-relaxed text-ink-70">
        {children}
      </div>
    </div>
  );
}
