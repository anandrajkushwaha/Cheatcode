import { Reveal } from "./Reveal";
import { JsonLd } from "@/components/JsonLd";
import { faqJsonLd } from "@/lib/seo/jsonld";

export const FAQ_ITEMS = [
  {
    q: "What is Cheatcode, exactly?",
    a: "The thing you use in the first few years of a career, when nobody has told you how any of it works. Today that is four things: a resume builder with an ATS check that shows what screening software actually reads, a job search across company boards and the big portals, AI mock interviews with a written report, and a career agent that has read your resume. More is coming — this is the window we are building for, not a single tool.",
  },
  {
    q: "What is free and what costs money?",
    a: "The resume builder, all 60 templates, PDF downloads with no watermark, the ATS checker, the salary calculator, the job search, the guides and the daily insights are free on every account, with no time limit and no card. Cheatcode Pro is ₹99 a month and adds the AI career agent, AI mock interviews and a human review of your resume. That is the whole price list.",
  },
  {
    q: "Who is Cheatcode actually for?",
    a: "Final-year students and people in their first few years of work. If you are figuring out placements, your first switch, or whether the job you took was a mistake — that is exactly the window we are built for.",
  },
  {
    q: "What does the ATS checker actually tell me?",
    a: "It reads your file the way screening software does and reports what came out: whether the text can be extracted at all, whether it is being read as two columns, whether standard section headings exist, and then the writing itself — opening verbs, numbers, dates, skills. No ATS publishes its scoring, so anything claiming to return your real Workday score is guessing. This is the checkable half, made measurable.",
  },
  {
    q: "Where do the jobs come from?",
    a: "Straight from company career boards — Greenhouse, Lever, Ashby — plus a search across the big portals. They are deduplicated, filtered by your city, your years and whether the role is genuinely remote, and every listing links out to the company's own application page. Nothing here is a sponsored placement.",
  },
  {
    q: "Are the mentor sessions live yet?",
    a: "No. Mentor sessions are the part still being built — we are onboarding mentors first, because a thin mentor pool is worse than none. Everything else on this page works today. If you are five or more years in and have hired people, there is an application form on the mentors section.",
  },
  {
    q: "How is this different from free advice online?",
    a: "General advice is written for a million people and none of them are you. Here the ATS check runs on your actual file, the job filters run on your actual profile, and the agent answers with your resume in front of it. Same subject, different kind of answer.",
  },
  {
    q: "How does the ₹99 billing work?",
    a: "UPI Autopay, charged when you subscribe and then once a month until you cancel. No lock-in, no cancellation fee, and the month you have already paid for stays yours. You are never charged unless you choose to subscribe, and nothing asks for a card when you sign up.",
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
