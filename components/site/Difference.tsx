import { Reveal } from "./Reveal";

const ROWS = [
  {
    label: "Free advice on YouTube",
    body: "Made for a million people. None of them are you. Great for context, useless for your specific rejection.",
  },
  {
    label: "Cold DMs on LinkedIn",
    body: "A 4% reply rate, and the replies are polite non-answers. Nobody owes a stranger the honest version.",
  },
  {
    label: "College placement cell",
    body: "Optimised for the placement percentage on the brochure, not for the next ten years of your career.",
  },
  {
    label: "Paid career 'courses'",
    body: "₹40,000 for recorded videos and a community tab. Sold by people who left the industry years ago.",
  },
];

export function Difference() {
  return (
    <section className="border-t border-ink-08 py-24 sm:py-36">
      <div className="container-page">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-ink-30">
                Why this and not that
              </p>
              <h2 className="mt-5 max-w-[16ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
                You&apos;ve already tried the free stuff.
              </h2>
              <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-ink-70">
                It didn&apos;t work because none of it was about you. Advice
                only becomes useful when the person giving it has seen your
                actual resume, your actual offer, your actual situation.
              </p>
            </Reveal>
          </div>

          <div>
            <ul className="divide-y divide-ink-08 border-y border-ink-08">
              {ROWS.map((row, i) => (
                <Reveal as="li" key={row.label} delay={i * 70}>
                  <div className="py-7">
                    <p className="text-[0.8rem] uppercase tracking-wider text-ink-30 line-through decoration-ink-15">
                      {row.label}
                    </p>
                    <p className="mt-2.5 text-[1.05rem] leading-relaxed text-ink-70">
                      {row.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={300}>
              <div className="mt-8 rounded-3xl bg-ink p-8 text-paper">
                <p className="text-[0.8rem] uppercase tracking-wider text-white/40">
                  Cheatcode
                </p>
                <p className="mt-2.5 text-[1.05rem] leading-relaxed text-white/85">
                  One person, still in the industry, who looks at your specific
                  situation for thirty minutes and tells you the truth. That
                  used to be a family connection. Now it&apos;s a booking.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
