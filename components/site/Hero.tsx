import { Reveal } from "./Reveal";
import { WaitlistForm } from "./WaitlistForm";
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
        <Reveal>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink-15 px-3.5 py-1.5 text-[0.7rem] font-medium tracking-wide text-ink-50 uppercase">
            <span className="size-1.5 rounded-full bg-ink" />
            Now taking early access signups
          </p>
        </Reveal>

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
          <div className="mx-auto mt-10 max-w-lg">
            <WaitlistForm source="hero" />
            <p className="mt-3 text-[0.8rem] text-ink-50">
              Free while we&apos;re in early access. No spam, one email when we
              open.
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
