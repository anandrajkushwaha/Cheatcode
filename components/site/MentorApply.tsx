import { Reveal } from "./Reveal";

/** The one place the form URL lives, so hero and footer CTA can never drift. */
export const MENTOR_FORM_URL = "https://forms.gle/vsQtMEz8EQDuxpZc7";

export function ApplyButton({
  location,
  tone = "dark",
  children = "Apply to mentor",
}: {
  location: string;
  tone?: "dark" | "light";
  children?: React.ReactNode;
}) {
  return (
    <a
      href={MENTOR_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-ev="cta_click"
      data-ev-location={location}
      data-ev-label="Apply to mentor"
      className={`inline-flex items-center justify-center rounded-full px-7 py-3.5 text-[0.95rem] font-medium transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97] ${
        tone === "dark"
          ? "bg-ink text-paper"
          : "bg-paper text-ink"
      }`}
    >
      {children}
    </a>
  );
}

const VALUE = [
  {
    n: "01",
    title: "Thirty minutes. That's the whole commitment.",
    body: "No content calendar. No cohort to run. No course to build. One call, one person, one problem they're stuck on. You show up, you talk, you're done.",
  },
  {
    n: "02",
    title: "You set the price. Including zero.",
    body: "Charge what half an hour of your time is worth. Or waive it entirely for the person who reminds you of yourself at twenty-two. That call is yours to make, every single time.",
  },
  {
    n: "03",
    title: "The room is the point.",
    body: "Everyone here was invited, one at a time. Engineers, designers, PMs, founders — five to fifteen years in. A private group where the people you'd normally cold-DM are just, quietly, around.",
  },
  {
    n: "04",
    title: "We handle everything that isn't the conversation.",
    body: "Profile, scheduling, reminders, payments, the person who doesn't turn up. You get a calendar invite and a name. Nothing else touches your week.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "You apply",
    body: "Four minutes. What you do, where you've done it, and what you're happy to be asked about.",
  },
  {
    n: "02",
    title: "We talk",
    body: "Fifteen minutes, both ways. You should be sure about us before we're sure about you.",
  },
  {
    n: "03",
    title: "You're in",
    body: "Profile live, calendar connected, slots on your terms. First conversation whenever you're ready for it.",
  },
];

export function MentorApply() {
  return (
    <>
      {/* ---------------------------------------------------------- hero */}
      <section className="border-b border-ink-08 pt-24 pb-20 sm:pt-32 sm:pb-28">
        <div className="container-page">
          <Reveal>
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-ink-30">
              By invitation
            </p>
            <h1 className="mt-6 max-w-[20ch] text-[length:var(--text-hero)] font-semibold leading-[0.98]">
              Someone is about to make a mistake you fixed five years ago.
            </h1>
          </Reveal>

          <Reveal delay={90}>
            <p className="mt-8 max-w-[46ch] text-xl leading-relaxed text-ink-50 sm:text-2xl">
              They don&apos;t need another course. They need thirty minutes with
              you.
            </p>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-11 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <ApplyButton location="mentor-hero" />
              <p className="text-[0.85rem] text-ink-30">
                Four minutes to apply. A person reads every one.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------- thesis */}
      <section className="bg-ink py-24 text-paper sm:py-28">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-20">
            <Reveal>
              <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-white/40">
                What this is
              </p>
              <h2 className="mt-5 max-w-[16ch] text-[length:var(--text-display)] font-semibold leading-[1.04]">
                Not content. Not courses. A conversation.
              </h2>
            </Reveal>

            <Reveal delay={90}>
              <p className="max-w-[52ch] text-lg leading-relaxed text-white/60">
                We&apos;re building a curated network of people who are genuinely
                good at what they do, and giving the next generation direct
                access to that experience. No cohorts. No curriculum. Nothing
                recorded and resold. Just the right conversation at the right
                time, with someone who has already stood exactly where
                they&apos;re standing.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- value */}
      <section className="py-24 sm:py-28">
        <div className="container-page">
          <Reveal>
            <h2 className="max-w-[20ch] text-[length:var(--text-title)] font-semibold leading-[1.1]">
              What you get out of it.
            </h2>
          </Reveal>

          <ul className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-ink-08 bg-ink-08 sm:grid-cols-2">
            {VALUE.map((v, i) => (
              <Reveal as="li" key={v.n} delay={(i % 2) * 80}>
                <div className="flex h-full flex-col bg-paper p-8 sm:p-10">
                  <p className="text-[0.8rem] font-medium tracking-[0.18em] text-ink-30">
                    {v.n}
                  </p>
                  <p className="mt-4 text-xl font-medium leading-snug tracking-[-0.02em]">
                    {v.title}
                  </p>
                  <p className="mt-3.5 text-[0.95rem] leading-relaxed text-ink-50">
                    {v.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------- invite only */}
      <section className="border-t border-ink-08 py-24 sm:py-28">
        <div className="container-page">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <Reveal>
              <h2 className="max-w-[14ch] text-[length:var(--text-title)] font-semibold leading-[1.1]">
                Why invitation only.
              </h2>
              <p className="mt-6 max-w-[42ch] text-[1.05rem] leading-relaxed text-ink-50">
                The moment anyone can be a mentor, no one is. Every person here is
                reviewed by a human — because a student&apos;s first honest
                conversation about their career shouldn&apos;t be a gamble.
              </p>
            </Reveal>

            <Reveal delay={90}>
              <ol className="space-y-9">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex gap-6">
                    <span className="mt-1 shrink-0 text-[0.8rem] font-medium tracking-[0.18em] text-ink-30">
                      {s.n}
                    </span>
                    <div>
                      <p className="text-lg font-medium tracking-[-0.02em]">
                        {s.title}
                      </p>
                      <p className="mt-2 max-w-[46ch] text-[0.95rem] leading-relaxed text-ink-50">
                        {s.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- final cta */}
      <section className="bg-ink py-24 text-paper sm:py-32">
        <div className="container-page text-center">
          <Reveal>
            <h2 className="mx-auto max-w-[18ch] text-[length:var(--text-display)] font-semibold leading-[1.04]">
              You already give this advice. Give it where it counts.
            </h2>
          </Reveal>

          <Reveal delay={90}>
            <p className="mx-auto mt-6 max-w-[44ch] text-lg leading-relaxed text-white/55">
              Half an hour. One person. The thing you wish someone had told you
              before you learned it the expensive way.
            </p>
          </Reveal>

          <Reveal delay={150}>
            <div className="mt-10 flex flex-col items-center gap-4">
              <ApplyButton location="mentor-final" tone="light" />
              <p className="text-[0.85rem] text-white/40">
                Applications are reviewed every week.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
