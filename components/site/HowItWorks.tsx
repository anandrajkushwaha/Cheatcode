import { Reveal } from "./Reveal";
import { SinglePhone } from "./PhoneMock";

const STEPS = [
  {
    n: "01",
    title: "Say where you're stuck",
    body: "Not a form with forty fields. One screen: what you're trying to do, and what's not working. Resume dying silently. Two offers, no clue which. Six months in and already lost.",
    screen: "discover" as const,
  },
  {
    n: "02",
    title: "We match you with someone who's been there",
    body: "Not a life coach. Someone 5–10 years into the exact path you're on — who has sat on hiring panels, written the rejection emails, and made the same mistakes before you.",
    screen: "booking" as const,
  },
  {
    n: "03",
    title: "30 minutes. Straight answers.",
    body: "No motivational speech. You leave with the specific thing to change, why it matters, and what to do this week. Come back when you're stuck again.",
    screen: "chat" as const,
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-ink-08 py-24 sm:py-36">
      <div className="container-page">
        <Reveal>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-ink-30">
            How it works
          </p>
          <h2 className="mt-5 max-w-[16ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
            Three steps. No networking required.
          </h2>
        </Reveal>

        <div className="mt-20 space-y-24 sm:space-y-32">
          {STEPS.map((step, i) => (
            <Reveal key={step.n}>
              <div
                className={`grid items-center gap-12 sm:grid-cols-2 sm:gap-16 ${
                  i % 2 === 1 ? "sm:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div>
                  <p className="text-[0.8rem] font-medium tracking-[0.18em] text-ink-30">
                    {step.n}
                  </p>
                  <h3 className="mt-4 text-[length:var(--text-title)] font-semibold leading-[1.1]">
                    {step.title}
                  </h3>
                  <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-70">
                    {step.body}
                  </p>
                </div>

                <div className="mx-auto w-full max-w-[248px]">
                  <SinglePhone screen={step.screen} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
