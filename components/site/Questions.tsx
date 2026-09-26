import { Reveal } from "./Reveal";
import { AuthCta } from "./AuthLinks";

const ROW_ONE = [
  "Is 6 LPA bad in 2026?",
  "Should I take the service company offer?",
  "How do I explain a 6-month gap?",
  "Do I need DSA if I want backend?",
  "Is my resume the problem, or is it me?",
];

const ROW_TWO = [
  "My manager ignores me. Is that normal?",
  "Should I do a master's or keep working?",
  "How much should I ask for?",
  "Everyone's switching. Should I?",
  "Am I too late at 24?",
];

function Marquee({
  items,
  reverse = false,
}: {
  items: string[];
  reverse?: boolean;
}) {
  const doubled = [...items, ...items];
  return (
    <div
      className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      aria-hidden="true"
    >
      <div
        className="animate-marquee flex shrink-0 gap-3 pr-3"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        {doubled.map((q, i) => (
          <span
            key={`${q}-${i}`}
            className="whitespace-nowrap rounded-full border border-ink-08 px-6 py-3.5 text-[0.95rem] text-ink-70"
          >
            {q}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Questions() {
  return (
    <section className="overflow-hidden border-t border-ink-08 bg-ink py-24 text-paper sm:py-36">
      <div className="container-page text-center">
        <Reveal>
          <p className="text-[0.75rem] font-medium uppercase tracking-[0.18em] text-white/40">
            The career agent
          </p>
          <h2 className="mx-auto mt-5 max-w-[22ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
            The questions you&apos;d never ask out loud.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-6 max-w-[54ch] text-lg leading-relaxed text-white/55">
            Not on LinkedIn, where your batchmates are watching. Not to a
            recruiter who is screening you. The agent has read your resume and
            knows what you are applying for — so the answer is about you, at
            one in the morning, without anybody finding out you asked.
          </p>
        </Reveal>
      </div>

      <div className="mt-16 space-y-3 [&_span]:border-white/12 [&_span]:text-white/70">
        <Marquee items={ROW_ONE} />
        <Marquee items={ROW_TWO} reverse />
      </div>

      <div className="container-page mt-14 text-center">
        <Reveal delay={120}>
          <AuthCta location="agent" invert />
          <p className="mt-4 text-[0.8rem] text-white/40">Part of Pro, ₹99 a month.</p>
        </Reveal>
      </div>

      {/* Screen-reader accessible version of the marquee content */}
      <ul className="sr-only">
        {[...ROW_ONE, ...ROW_TWO].map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
    </section>
  );
}
