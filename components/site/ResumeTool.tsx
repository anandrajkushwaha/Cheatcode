import Link from "next/link";
import { Reveal } from "./Reveal";
import { SinglePhone } from "./PhoneMock";

const CAPABILITIES = [
  {
    n: "01",
    title: "See what the software sees",
    body: "Upload the resume you're already sending. Get the version a screening system reads — the parts it skipped, the sections it couldn't find, the score it hands the recruiter before a human opens anything.",
  },
  {
    n: "02",
    title: "Fixes, not advice",
    body: "Not \"add more keywords\". The actual line, rewritten, with the reason. You approve each change or you don't. Nothing is edited behind your back.",
  },
  {
    n: "03",
    title: "Start from nothing",
    body: "No resume yet, or one built in Canva that falls apart when parsed? Build from a format that survives the machine — and still looks like it was made by a person.",
  },
  {
    n: "04",
    title: "One role at a time",
    body: "Paste the job description. Your resume reshapes itself for that one posting — the same experience, ordered and worded for what that specific team is screening on.",
  },
];

export function ResumeTool() {
  return (
    <section id="resume" className="scroll-mt-16 border-t border-ink-08 bg-ink py-24 text-paper sm:py-36">
      <div className="container-page">
        <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <div>
            <Reveal>
              <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-white/40">
                The second half
              </p>
              <h2 className="mt-5 max-w-[18ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
                A mentor can&apos;t fix what a machine already deleted.
              </h2>
            </Reveal>

            <Reveal delay={80}>
              <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-white/60">
                Before any of this becomes a conversation, your resume has to survive
                software that never reads a sentence. Most don&apos;t. That&apos;s not a
                talent problem — it&apos;s a formatting problem nobody told you about.
              </p>
              <p className="mt-4 max-w-[54ch] text-lg leading-relaxed text-white/60">
                So we&apos;re building the other half: a resume tool that gets you into
                the room. The mentor is what happens once you&apos;re in.
              </p>
            </Reveal>
          </div>

          <Reveal delay={140}>
            <div className="mx-auto w-full max-w-[248px]">
              <SinglePhone screen="resume" />
            </div>
          </Reveal>
        </div>

        <ul className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-white/12 bg-white/12 sm:grid-cols-2">
          {CAPABILITIES.map((c, i) => (
            <Reveal as="li" key={c.n} delay={(i % 2) * 80}>
              <div className="flex h-full flex-col bg-ink p-8 sm:p-9">
                <p className="text-[0.8rem] font-medium tracking-[0.18em] text-white/30">
                  {c.n}
                </p>
                <p className="mt-4 text-xl font-medium leading-snug tracking-[-0.02em]">
                  {c.title}
                </p>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-white/55">
                  {c.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={220}>
          <div className="mt-12 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[48ch] text-[0.95rem] leading-relaxed text-white/50">
              Both are on the same waitlist. One email when we open — you pick what you
              use first.
            </p>
            <Link
              href="#waitlist"
              className="shrink-0 rounded-full bg-paper px-6 py-3 text-[0.9rem] font-medium text-ink transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.03] active:scale-[0.97]"
            >
              Get early access
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
