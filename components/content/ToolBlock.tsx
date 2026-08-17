import Link from "next/link";

/**
 * The in-article promo for a free tool.
 *
 * Previously this was hard-coded to the salary calculator, which meant adding
 * a second tool would have meant a second copy of the same markup. Keyed by
 * slug instead, so the article data decides what appears and the template
 * doesn't need to know how many tools exist.
 */
const TOOLS: Record<
  string,
  { eyebrow: string; title: string; body: string; cta: string; href: string }
> = {
  "resume-ats-checker": {
    eyebrow: "Free tool",
    title: "See what an ATS actually reads on your resume",
    body:
      "Upload the file you're already sending and get the score, plus the exact lines costing you it. Read in your browser — the file is never uploaded.",
    cta: "Check my resume",
    href: "/tools/resume-ats-checker",
  },
  "in-hand-salary-calculator": {
    eyebrow: "Free tool",
    title: "Work out what your CTC actually becomes in hand",
    body:
      "Every deduction, current tax rules, no signup. Your numbers never leave your browser.",
    cta: "Open the calculator",
    href: "/tools/in-hand-salary-calculator",
  },
};

export function ToolBlock({ slugs }: { slugs?: string[] }) {
  // At most one block per article: two dark panels stacked reads as an ad break.
  const slug = (slugs ?? []).find((s) => s in TOOLS);
  if (!slug) return null;

  const t = TOOLS[slug];

  return (
    <aside className="mt-14 rounded-3xl bg-ink p-8 text-paper">
      <p className="text-[0.72rem] uppercase tracking-[0.16em] text-white/40">{t.eyebrow}</p>
      <p className="mt-2.5 text-xl font-medium tracking-[-0.02em]">{t.title}</p>
      <p className="mt-2.5 max-w-[54ch] text-[0.95rem] leading-relaxed text-white/60">{t.body}</p>
      <Link
        href={t.href}
        data-ev="cta_click"
        data-ev-location="article-tool-block"
        data-ev-label={t.cta}
        className="mt-6 inline-block rounded-full bg-paper px-5 py-2.5 text-[0.85rem] font-medium text-ink"
      >
        {t.cta}
      </Link>
    </aside>
  );
}
