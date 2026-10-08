import Link from "next/link";
import { ExamCard } from "@/components/govt/bits";
import type { Exam } from "@/lib/govt/types";

/**
 * A list of recruitments in one lifecycle state.
 *
 * Three pages share it — closing soon, closed, and the ones whose closing date
 * nobody has verified. They exist separately rather than as filters on one
 * list because each makes a different claim, and a page that mixes them has
 * to either make the strongest claim about all of them or none.
 */
export function ExamListScreen({
  title,
  blurb,
  exams,
  emptyLine,
}: {
  title: string;
  blurb: string;
  exams: Exam[];
  emptyLine: string;
}) {
  return (
    <div className="container-page pb-32 pt-8 sm:pb-28 sm:pt-10">
      <nav className="mb-5 text-[0.8rem] text-ink-30">
        <Link href="/government-jobs" className="transition-colors hover:text-ink">
          Government jobs
        </Link>
        <span className="px-1.5">/</span>
        <span>{title}</span>
      </nav>

      <header className="max-w-[62ch]">
        <h1 className="text-[1.6rem] font-semibold tracking-[-0.035em] sm:text-[2rem]">{title}</h1>
        <p className="mt-2.5 text-[0.95rem] leading-relaxed text-ink-50">{blurb}</p>
      </header>

      {exams.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-ink-15 p-8 text-center text-[0.88rem] text-ink-50">
          {emptyLine}
        </p>
      ) : (
        <ul className="mt-8 grid items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((e) => (
            <li key={e.id}>
              <ExamCard exam={e} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 max-w-[70ch] text-[0.8rem] leading-relaxed text-ink-30">
        Cheatcode is not a government body. Every notice links to the official notification on the
        recruiting authority&apos;s own website, and that page is the one to rely on.
      </p>
    </div>
  );
}
