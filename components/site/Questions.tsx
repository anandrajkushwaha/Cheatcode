import { Reveal } from "./Reveal";

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
          <h2 className="mx-auto max-w-[20ch] text-[length:var(--text-display)] font-semibold leading-[1.02]">
            The questions you&apos;d never ask out loud.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-6 max-w-[52ch] text-lg leading-relaxed text-white/55">
            Not on LinkedIn, where your batchmates are watching. Not to a
            recruiter who&apos;s screening you. To one person, privately, who
            has no reason to lie to you.
          </p>
        </Reveal>
      </div>

      <div className="mt-16 space-y-3 [&_span]:border-white/12 [&_span]:text-white/70">
        <Marquee items={ROW_ONE} />
        <Marquee items={ROW_TWO} reverse />
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
