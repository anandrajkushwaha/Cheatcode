import { Reveal } from "./Reveal";
import { AuthCta } from "./AuthLinks";

export function FinalCta() {
  return (
    <section
      id="get-started"
      className="scroll-mt-20 border-t border-ink-08 bg-ink py-28 text-paper sm:py-40"
    >
      {/*
        `#waitlist` is kept as a second anchor rather than deleted. It is the
        target of links in published guides, in the tools pages, and in
        whatever anybody has shared — and a fragment that no longer resolves
        does not error, it silently lands the person at the top of the page
        with no idea they were meant to arrive somewhere. An empty span costs
        nothing and keeps every one of those links pointing at the sign-up.
      */}
      <span id="waitlist" aria-hidden="true" className="block scroll-mt-20" />

      <div className="container-narrow text-center">
        <Reveal>
          <h2 className="mx-auto max-w-[16ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
            Stop guessing what everyone else already knows.
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <p className="mx-auto mt-6 max-w-[48ch] text-lg leading-relaxed text-white/55">
            One account, both things — the mentor sessions and the resume
            builder. Make it in about ten seconds and start with the resume.
          </p>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <AuthCta location="footer-cta" invert />
            <a
              href="/signin"
              data-ev="cta_click"
              data-ev-location="footer-cta"
              data-ev-label="Log in"
              className="text-[0.9rem] text-white/55 underline-offset-4 transition-colors hover:text-paper hover:underline"
            >
              I already have an account
            </a>
          </div>
        </Reveal>

        <Reveal delay={220}>
          <p className="mt-6 text-[0.8rem] text-white/40">
            Free to start · Google or phone sign-in · No spam, ever
          </p>
        </Reveal>
      </div>
    </section>
  );
}
