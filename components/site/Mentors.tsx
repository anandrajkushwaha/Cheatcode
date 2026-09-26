import { Reveal } from "./Reveal";
import { ApplyButton } from "./MentorApply";

/**
 * Mentor sessions: said as a plan, not as a product.
 *
 * This section used to be six cards headed "The people you'll talk to", with
 * names, roles, years and a line about each. They were invented — the file's
 * own comment called them "role archetypes, not real people" — and there is
 * no mentors table, no booking, no payment and nothing in the app behind any
 * of it. Presenting them as people you could talk to was the single least
 * honest thing on the site, and the one most likely to be the reason a
 * sign-up feels like a bait-and-switch ten seconds later.
 *
 * So: no faces, no fake credentials, no "book now". What is coming, what is
 * true about it today, and a way in for the people who would make it real.
 */
const WHAT = [
  {
    title: "Someone five years ahead, not a coach",
    body: "People who still work the job and have sat on the hiring side of it. Not course sellers, and not anybody whose last real interview was in 2016.",
  },
  {
    title: "Thirty minutes about your situation",
    body: "Your resume, your offer, your call to make. The version of the answer nobody gives a stranger politely on LinkedIn.",
  },
  {
    title: "A price you see before anything else",
    body: "Sessions will be paid and priced per mentor. You will see the number before you are ever asked for a card.",
  },
];

export function Mentors() {
  return (
    <section id="mentors" className="border-t border-ink-08 py-24 sm:py-36">
      <div className="container-page">
        <div className="grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal>
              <span className="inline-block rounded-full border border-ink-15 px-3 py-1 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-ink-30">
                In the works
              </span>
              <h2 className="mt-5 max-w-[18ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
                The part we haven&apos;t built yet.
              </h2>
            </Reveal>

            <Reveal delay={80}>
              <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink-70">
                Tools get you to the interview. For the questions that are
                actually about your life — take this offer or wait, switch now
                or in a year — you want a person.
              </p>
              <p className="mt-4 max-w-[46ch] text-[0.95rem] leading-relaxed text-ink-50">
                Mentor sessions are not live. We are onboarding mentors first,
                because a thin mentor pool is worse than none at all. Everything
                else on this page works today.
              </p>
            </Reveal>
          </div>

          <div>
            <ul className="divide-y divide-ink-08 border-y border-ink-08">
              {WHAT.map((w, i) => (
                <Reveal as="li" key={w.title} delay={i * 70}>
                  <div className="py-7">
                    <p className="text-[1.05rem] font-medium leading-snug tracking-[-0.02em]">
                      {w.title}
                    </p>
                    <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink-50">{w.body}</p>
                  </div>
                </Reveal>
              ))}
            </ul>

            <Reveal delay={240}>
              <div className="mt-8 rounded-3xl bg-ink p-8 text-paper">
                <p className="text-[0.8rem] uppercase tracking-wider text-white/40">
                  Five years in, or more?
                </p>
                <p className="mt-2.5 max-w-[46ch] text-[1.05rem] leading-relaxed text-white/85">
                  If you have been on the hiring side of a table, you are who this
                  is waiting on. Tell us what you do and we will come back to you
                  when sessions open.
                </p>
                <div className="mt-6">
                  <ApplyButton location="home-mentors" tone="light" />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
