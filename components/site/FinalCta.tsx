import { Reveal } from "./Reveal";
import { WaitlistForm } from "./WaitlistForm";

export function FinalCta() {
  return (
    <section
      id="waitlist"
      className="scroll-mt-20 border-t border-ink-08 bg-ink py-28 text-paper sm:py-40"
    >
      <div className="container-narrow text-center">
        <Reveal>
          <h2 className="mx-auto max-w-[16ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
            Stop guessing what everyone else already knows.
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <p className="mx-auto mt-6 max-w-[48ch] text-lg leading-relaxed text-white/55">
            We&apos;re letting people in slowly, in batches, as mentors come on
            board. Get on the list and you&apos;ll be in the first one.
          </p>
        </Reveal>

        <Reveal delay={160}>
          <div className="mx-auto mt-10 max-w-lg [&_form]:sm:border-white/15 [&_form]:sm:bg-white/5 [&_form]:sm:focus-within:border-white [&_input]:border-white/20 [&_input]:text-paper [&_input]:placeholder:text-white/35 sm:[&_input]:border-0 [&_button]:bg-paper [&_button]:text-ink">
            <WaitlistForm source="footer-cta" />
          </div>
        </Reveal>

        <Reveal delay={220}>
          <p className="mt-6 text-[0.8rem] text-white/40">
            Free during early access · One email when we open · No spam, ever
          </p>
        </Reveal>
      </div>
    </section>
  );
}
