"use client";

import { useId, useState } from "react";

/**
 * The FAQ.
 *
 * The questions are the design's eight, rewritten for this product. That
 * rewriting is not cosmetic: the originals described somebody else's plan, and
 * three of them (validity, attempts, mock interviews) would have been
 * straightforwardly untrue here.
 *
 * Two of the answers exist for a second reason. A payment gateway reviewing
 * this site looks for a plain statement of what recurs, when, and how to stop
 * it — so billing and cancellation are answered here in as many words rather
 * than left to the policy pages.
 *
 * One panel open at a time, first one open on arrival, matching the design.
 */

type Item = { q: string; a: string };

const FAQ: Item[] = [
  {
    q: "What is Cheatcode Pro?",
    a: "Cheatcode Pro brings together everything you need to build a strong resume, find roles worth applying to, and prepare for the interview — an AI career agent that knows your profile, an AI resume builder, and the premium template set. All in one place, for ₹99 a month.",
  },
  {
    q: "Who can benefit from Cheatcode Pro?",
    a: "Anyone applying for jobs in India — students looking for their first role, working professionals moving on, and people returning after a break. If you are sending applications and not hearing back, most of the gap is usually in the resume and the preparation, which is what Pro is built around.",
  },
  {
    q: "How long is Cheatcode Pro valid, and how do I cancel?",
    a: "Pro is a monthly plan. ₹99 is charged when you subscribe and then once every month through UPI Autopay, until you cancel. You can cancel any time from this page or by writing to us — there is no lock-in and no cancellation fee. When you cancel, the month you have already paid for stays yours and nothing is charged after that.",
  },
  {
    q: "What kind of mock interviews are available?",
    a: "AI mock interviews are being built and are not part of the plan yet — they are listed above with a Coming soon label so nobody pays for them expecting them today. When they arrive they will be included in Pro at no extra cost, for the roles you have saved on your profile.",
  },
  {
    q: "How many AI attempts do I get?",
    a: "Pro removes the daily limits that apply on the free plan, so you can rewrite a resume section, re-run a job match, or ask the career agent as often as you need within fair use. Fair use exists only to stop automated abuse; ordinary job-hunting will never come near it.",
  },
  {
    q: "Can I prepare for more than one role?",
    a: "Yes. You can keep several target roles on your profile and hold a separate resume for each one, which is the usual situation when you are applying across two or three kinds of job. The agent tailors its suggestions to whichever role you are working on.",
  },
  {
    q: "Can I edit and download my resume more than once?",
    a: "As many times as you like, for as long as your plan is active. Your resumes stay in your account, you can go back and change any version, and every download is a fresh PDF — there is no per-download charge and no watermark.",
  },
  {
    q: "Who should I contact for help?",
    a: "Write to hello@cheatcodeapp.com and a person will reply. Billing questions, refunds, a resume that will not generate — all of it goes to the same address, and we would much rather hear about a problem than have you cancel over it.",
  },
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`size-[14px] shrink-0 text-[#474d6a] transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ProFaq() {
  const [open, setOpen] = useState(0);
  const base = useId();

  return (
    <section>
      <h2 className="text-center text-[1.35rem] font-bold tracking-[-0.02em] text-[#121224] sm:text-[1.875rem]">
        Frequently asked questions
      </h2>

      <div className="mt-8 sm:mt-10">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          const panel = `${base}-p${i}`;
          return (
            <div
              key={item.q}
              className={i < FAQ.length - 1 ? "border-b border-[#e7e7f1]" : ""}
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  className="flex w-full items-start justify-between gap-4 py-5 text-left"
                >
                  <span className="flex min-w-0 items-start">
                    <span className="shrink-0 pr-2.5 text-[0.875rem] font-bold leading-[20px] text-[#474d6a]">
                      Q{i + 1}
                    </span>
                    <span className="text-[0.925rem] font-medium leading-[20px] text-[#121224] sm:text-[1rem]">
                      {item.q}
                    </span>
                  </span>
                  <Chevron open={isOpen} />
                </button>
              </h3>

              <div
                id={panel}
                hidden={!isOpen}
                className="pb-5 pl-[29px] pr-2 sm:max-w-[640px]"
              >
                <p className="text-[0.9rem] font-medium leading-[1.5] text-[#657095] sm:text-[1rem]">
                  {item.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
