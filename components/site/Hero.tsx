import { Reveal } from "./Reveal";
import { AuthCta } from "./AuthLinks";
import { PhoneCluster } from "./PhoneMock";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32"
    >
      {/* Soft radial floor light — pure greyscale */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[42%] -z-10 h-[520px] bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(0,0,0,0.05),transparent_70%)]"
      />

      <div className="container-page text-center">
        <Reveal delay={60}>
          <h1 className="mx-auto max-w-[15ch] text-[length:var(--text-hero)] font-semibold leading-[0.95]">
            Someone&apos;s cousin works at Google.
          </h1>
          <p className="mx-auto mt-3 max-w-[15ch] text-[length:var(--text-hero)] font-semibold leading-[0.95] text-ink-30">
            You have Cheatcode.
          </p>
        </Reveal>

        <Reveal delay={140}>
          <p className="mx-auto mt-8 max-w-[52ch] text-lg leading-relaxed text-ink-70 sm:text-xl">
            The people who move fast early aren&apos;t smarter. They just have
            someone to ask. Cheatcode gives you 1-on-1 time with people 5–10
            years ahead of you — the ones who&apos;ve read your resume from the
            other side of the table.
          </p>
        </Reveal>

        <Reveal delay={220}>
          {/*
            This was an email box on a waitlist. The waitlist was honest while
            there was nothing to open; now there is, and asking for an address
            in order to send somebody a link to a page they could already be
            standing on is a step that only loses people.
          */}
          <div className="mx-auto mt-10 flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <AuthCta location="hero" />
              <a
                href="/signin"
                data-ev="cta_click"
                data-ev-location="hero"
                data-ev-label="Log in"
                className="text-[0.9rem] text-ink-50 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                I already have an account
              </a>
            </div>
            <p className="text-[0.8rem] text-ink-50">
              Free to start. Sign in with Google or your phone number.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={280}>
        <div className="container-page mt-20 sm:mt-28">
          <PhoneCluster />
        </div>
      </Reveal>
    </section>
  );
}
