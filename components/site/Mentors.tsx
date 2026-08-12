import { Reveal } from "./Reveal";

/**
 * Placeholder mentor cards — role archetypes, not real people.
 * Replace with real profiles from the `mentors` table once onboarding starts.
 */
const MENTORS = [
  {
    initials: "RS",
    role: "SDE-2, fintech",
    years: "7 yrs",
    note: "Has been on 200+ interview panels. Knows exactly which line of your resume gets you skipped.",
  },
  {
    initials: "AK",
    role: "Product Manager, marketplace",
    years: "9 yrs",
    note: "Switched from engineering at year four. The person to ask if you're wondering whether you're in the wrong role.",
  },
  {
    initials: "MN",
    role: "Data Scientist, consumer app",
    years: "6 yrs",
    note: "Started at a service company like most people do. Knows how to make that jump actually happen.",
  },
  {
    initials: "PT",
    role: "Engineering Manager, SaaS",
    years: "11 yrs",
    note: "Approves the offers. Will tell you what your salary negotiation sounded like from the other side.",
  },
  {
    initials: "SV",
    role: "Designer, health tech",
    years: "8 yrs",
    note: "Built a portfolio with zero agency experience. Reviews yours the way a hiring manager actually reads it.",
  },
  {
    initials: "DJ",
    role: "Backend Engineer, retail",
    years: "6 yrs",
    note: "Failed 40 interviews before the one that worked. Has the honest version of that story.",
  },
];

export function Mentors() {
  return (
    <section id="mentors" className="border-t border-ink-08 py-24 sm:py-36">
      <div className="container-page">
        <Reveal>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-ink-30">
            The people you&apos;ll talk to
          </p>
          <h2 className="mt-5 max-w-[20ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
            Not gurus. Not influencers.
            <span className="text-ink-30">
              {" "}
              People with a job, five years ahead of yours.
            </span>
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-ink-70">
            Everyone selling career advice online is selling a course. Our
            mentors still work the job. That&apos;s the whole difference — they
            know what hiring looks like this year, not the year they got lucky.
          </p>
        </Reveal>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MENTORS.map((m, i) => (
            <Reveal as="li" key={m.initials} delay={(i % 3) * 80}>
              <div className="group flex h-full flex-col rounded-3xl border border-ink-08 p-7 transition-colors duration-300 hover:border-ink-30">
                <div className="flex min-h-12 items-center gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-[0.8rem] font-semibold tracking-tight text-paper">
                    {m.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.95rem] font-medium leading-tight text-balance">
                      {m.role}
                    </p>
                    <p className="mt-1 text-[0.8rem] text-ink-30">
                      {m.years} in industry
                    </p>
                  </div>
                </div>
                <p className="mt-6 text-[0.95rem] leading-relaxed text-ink-50">
                  {m.note}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
