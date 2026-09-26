import { Reveal } from "./Reveal";
import { AuthCta } from "./AuthLinks";
import { PRO_PRICE_PER_MONTH } from "@/lib/studio/plan";

/**
 * What costs money, said before the sign-up rather than after it.
 *
 * The price was only ever visible inside the app, on the upgrade screen —
 * which meant the first time anybody heard a number was after they had
 * handed over a phone number. Putting it here costs a few sign-ups from
 * people who were never going to pay, and buys the trust of everybody else.
 *
 * The two lists are what the code actually enforces, not what we would like
 * to be selling: the builder, templates and tools are ungated, and the agent,
 * mock interviews and human review return a 402 without a subscription.
 */
const FREE = [
  "Resume builder, all 60 templates",
  "PDF downloads, no watermark",
  "ATS checker and salary calculator",
  "Job search across boards and portals",
  "Guides and daily job-market insights",
];

const PRO = [
  "AI career agent that has read your resume",
  "AI mock interviews with a written report",
  "A real person reviews your resume",
  "Everything in Free, unchanged",
];

export function Plans() {
  return (
    <section id="pricing" className="scroll-mt-16 border-t border-ink-08 py-24 sm:py-36">
      <div className="container-page">
        <Reveal>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-ink-30">
            What it costs
          </p>
          <h2 className="mt-5 max-w-[20ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
            Most of it is free.
            <span className="text-ink-30"> The rest is ₹{PRO_PRICE_PER_MONTH} a month.</span>
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-ink-70">
            Not a trial that expires in seven days. The free account is the
            product for most people, and it stays that way.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-ink-08 bg-ink-08 lg:grid-cols-2">
          <Reveal>
            <div className="flex h-full flex-col bg-paper p-8 sm:p-10">
              <p className="text-[0.8rem] uppercase tracking-wider text-ink-30">Free</p>
              <p className="mt-3 text-[2.5rem] font-semibold leading-none tracking-[-0.045em]">₹0</p>
              <p className="mt-2 text-[0.9rem] text-ink-50">No card. No expiry.</p>
              <ul className="mt-8 flex-1 space-y-3">
                {FREE.map((f) => (
                  <li key={f} className="flex gap-3 text-[0.95rem] leading-relaxed text-ink-70">
                    <span aria-hidden="true" className="mt-[0.15rem] text-ink-30">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-9">
                <AuthCta location="pricing-free" />
              </div>
            </div>
          </Reveal>

          <Reveal delay={90}>
            <div className="flex h-full flex-col bg-ink p-8 text-paper sm:p-10">
              <p className="text-[0.8rem] uppercase tracking-wider text-white/40">Pro</p>
              <p className="mt-3 text-[2.5rem] font-semibold leading-none tracking-[-0.045em]">
                ₹{PRO_PRICE_PER_MONTH}
                <span className="text-[1rem] font-normal text-white/40"> / month</span>
              </p>
              <p className="mt-2 text-[0.9rem] text-white/55">
                UPI Autopay. Cancel any month.
              </p>
              <ul className="mt-8 flex-1 space-y-3">
                {PRO.map((f) => (
                  <li key={f} className="flex gap-3 text-[0.95rem] leading-relaxed text-white/75">
                    <span aria-hidden="true" className="mt-[0.15rem] text-white/40">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-9">
                <AuthCta location="pricing-pro" invert />
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <p className="mt-6 text-[0.85rem] text-ink-50">
            Start free. You will see Pro inside the app and can decide then — nothing
            asks for a card on the way in.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
