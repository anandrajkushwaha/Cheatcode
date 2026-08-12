import { Reveal } from "./Reveal";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd } from "@/lib/seo/jsonld";

export const FAQ_ITEMS = [
  {
    q: "Who is Cheatcode actually for?",
    a: "Final-year students and people in their first two years of work. If you're figuring out placements, your first switch, or whether the job you took was a mistake — that's exactly the window we're built for.",
  },
  {
    q: "How is this different from free advice online?",
    a: "General advice is written for a million people. A mentor looks at your resume, your offer, your situation and tells you the specific thing to change. That's a different kind of answer.",
  },
  {
    q: "Who are the mentors?",
    a: "People with 5–10+ years of experience who still work in the industry. Most have sat on hiring panels, reviewed resumes, and made the decisions you're currently guessing about.",
  },
  {
    q: "What does it cost?",
    a: "Early access is free while we're building. We'll tell you well before that changes — and you'll never be charged without asking first.",
  },
  {
    q: "What can I actually ask?",
    a: "Anything you'd ask an older sibling in the industry. Why you keep getting rejected, whether an offer is fair, if you should switch, how to handle a manager, whether you're behind. Nothing is too small or too obvious.",
  },
  {
    q: "When does it open?",
    a: "We're onboarding mentors first — a good mentor pool matters more than a fast launch. Join the list and you'll be in the first batch we let in.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-t border-ink-08 py-24 sm:py-36">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <Reveal className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-[length:var(--text-display)] font-semibold leading-[1.02]">
              Questions,
              <span className="text-ink-30"> answered.</span>
            </h2>
          </Reveal>

          <div className="divide-y divide-ink-08 border-t border-ink-08">
            {FAQ_ITEMS.map((item, i) => (
              <Reveal key={item.q} delay={i * 50}>
                <details className="group py-6">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[1.05rem] font-medium leading-snug [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="relative mt-1.5 size-3.5 shrink-0"
                    >
                      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-ink-50" />
                      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-ink-50 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-open:rotate-90 group-open:opacity-0" />
                    </span>
                  </summary>
                  <p className="mt-4 max-w-[62ch] text-[1rem] leading-relaxed text-ink-50">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />
    </section>
  );
}
