import { Reveal } from "./Reveal";

const PROBLEMS = [
  {
    stat: "400+",
    statLabel: "applications sent",
    headline: "Three replies.",
    body: "Nobody told you 75% of resumes are filtered by software before a human ever opens them. You kept applying harder instead of differently.",
  },
  {
    stat: "₹8 LPA",
    statLabel: "on the offer letter",
    headline: "₹52,400 in your account.",
    body: "You said yes to a number you didn't understand. Gratuity, variable pay, that 'retention bonus' in year two — someone should have walked you through it.",
  },
  {
    stat: "4 rounds",
    statLabel: "cleared",
    headline: "Rejected. No reason given.",
    body: "HR won't tell you. Your friends can't. So you guess, change five things at once, and repeat the same mistake in the next interview.",
  },
];

export function Problem() {
  return (
    <section className="border-t border-ink-08 py-24 sm:py-36">
      <div className="container-page">
        <Reveal>
          <h2 className="max-w-[18ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
            You&apos;re not underqualified.
            <span className="text-ink-30"> You&apos;re under-advised.</span>
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-ink-70">
            Every rejection teaches you nothing, because nobody explains it. The
            gap between you and the person who got the offer usually isn&apos;t
            talent. It&apos;s information.
          </p>
        </Reveal>

        <ul className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-ink-08 bg-ink-08 sm:grid-cols-3">
          {PROBLEMS.map((item, i) => (
            <Reveal as="li" key={item.stat} delay={i * 90}>
              <div className="flex h-full flex-col bg-paper p-8 sm:p-9">
                <p className="text-[2.5rem] font-semibold leading-none tracking-[-0.045em]">
                  {item.stat}
                </p>
                <p className="mt-2 text-[0.8rem] uppercase tracking-wider text-ink-30">
                  {item.statLabel}
                </p>
                <p className="mt-8 text-xl font-medium leading-snug tracking-[-0.02em]">
                  {item.headline}
                </p>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-50">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
