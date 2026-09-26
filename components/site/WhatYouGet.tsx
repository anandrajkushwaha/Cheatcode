import Link from "next/link";
import { Reveal } from "./Reveal";
import { SinglePhone } from "./PhoneMock";

/**
 * What is behind the sign-up button.
 *
 * This section used to be three steps of a mentor booking flow — say where
 * you're stuck, get matched, talk for thirty minutes. None of that was built,
 * so somebody who read it, signed up and landed in the app found a different
 * product than the one they had just agreed to. Everything listed here exists
 * and can be opened the minute an account is made.
 */
const THINGS = [
  {
    n: "01",
    title: "Roles worth applying to",
    body: "Openings pulled straight from company boards and the big portals, filtered by your city, your years and whether it is actually remote. No sponsored listings, and no six-month-old posting that was filled in March.",
    href: "/signin?next=/app/jobs",
    linkText: "See open roles",
    screen: "discover" as const,
  },
  {
    n: "02",
    title: "The interview, before the interview",
    body: "Mock rounds for the role you are actually applying for, answered by typing or speaking. Afterwards you get the written version: what each answer was missing, and the same answer rewritten the way it should have been said.",
    href: "/signin?next=/app/interviews",
    linkText: "Try a mock round",
    screen: "booking" as const,
  },
  {
    n: "03",
    title: "What changed this week",
    body: "EPFO rules, wage ceilings, who is hiring and who quietly stopped — read in seventy words, not a thousand. Plus the long guides for the things worth understanding properly once.",
    href: "/blog",
    linkText: "Read the guides",
    screen: "chat" as const,
  },
];

export function WhatYouGet() {
  return (
    <section id="how" className="border-t border-ink-08 py-24 sm:py-36">
      <div className="container-page">
        <Reveal>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-ink-30">
            Also in the account
          </p>
          <h2 className="mt-5 max-w-[20ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
            And then the rest of the search.
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-ink-70">
            Getting read is the first problem, not the only one. All of this
            opens the moment you make an account.
          </p>
        </Reveal>

        <div className="mt-20 space-y-24 sm:space-y-32">
          {THINGS.map((t, i) => (
            <Reveal key={t.n}>
              <div
                className={`grid items-center gap-12 sm:grid-cols-2 sm:gap-16 ${
                  i % 2 === 1 ? "sm:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div>
                  <p className="text-[0.8rem] font-medium tracking-[0.18em] text-ink-30">
                    {t.n}
                  </p>
                  <h3 className="mt-4 text-[length:var(--text-title)] font-semibold leading-[1.1]">
                    {t.title}
                  </h3>
                  <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-70">
                    {t.body}
                  </p>
                  <Link
                    href={t.href}
                    data-ev="cta_click"
                    data-ev-location="what-you-get"
                    data-ev-label={t.title}
                    className="mt-6 inline-block text-[0.9rem] underline underline-offset-4 transition-colors hover:text-ink-50"
                  >
                    {t.linkText}
                  </Link>
                </div>

                <div className="mx-auto w-full max-w-[248px]">
                  <SinglePhone screen={t.screen} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
