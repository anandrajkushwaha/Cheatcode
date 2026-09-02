import Link from "next/link";
import { getPrimaryDraft, getPrimaryResume } from "@/lib/app/account";
import { ResumeDocument } from "@/components/app/ResumeDocument";
import { BuildDraftButton, PrintButton } from "@/components/app/ResumeBuilderActions";
import { ScoreRing } from "@/components/app/ui";

export const dynamic = "force-dynamic";

/**
 * The resume, rebuilt.
 *
 * An ATS score is a verdict on a document somebody already has, and a verdict
 * with no next move is just a bad mood. This is the next move: the same
 * content, in a document whose layout we chose, scored by the same function
 * so the improvement is a measurement rather than a promise.
 *
 * Read-only for now, deliberately. The template plus the fields they have
 * already filled banks 36 of the 111 points on its own; the editor and the
 * agent's rewrites are what move the rest, and neither is worth building
 * before the document they edit exists.
 */
export default async function ResumeBuilderPage() {
  const [draft, resume] = await Promise.all([getPrimaryDraft(), getPrimaryResume()]);

  if (!draft) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Resume builder</h1>
        <p className="mt-2.5 max-w-[62ch] text-[0.92rem] leading-relaxed text-ink-50">
          {resume
            ? "We'll start from the resume you already uploaded — your roles, dates and bullets, " +
              "already in place — and lay them out in a format applicant tracking software can " +
              "actually read."
            : "Upload a resume first. The builder starts from what you've already written rather " +
              "than from a blank page."}
        </p>

        <div className="mt-7">
          {resume ? (
            <BuildDraftButton label="Build it from my resume" />
          ) : (
            <Link
              href="/app/resume"
              className="inline-flex rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-semibold text-paper transition-transform hover:scale-[1.02]"
            >
              Upload a resume
            </Link>
          )}
        </div>
      </>
    );
  }

  const result = draft.ats_result;
  const score = draft.ats_score ?? 0;
  const before = resume?.ats_score ?? null;
  const gained = before !== null ? score - before : null;
  const failing = (result?.checks ?? []).filter((c) => c.status !== "pass");

  return (
    <>
      <div className="no-print">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Resume builder</h1>
          <Link
            href="/app/resume"
            className="text-[0.82rem] text-ink-30 underline-offset-4 hover:text-ink hover:underline"
          >
            Back to your resume
          </Link>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl border border-ink-08 p-6">
            <div className="flex flex-wrap items-center gap-5">
              <ScoreRing score={score} />
              <div className="min-w-0">
                <p className="text-[1.02rem] font-medium">{result?.verdict ?? "Scored"}</p>
                {gained !== null && (
                  <p className="mt-1.5 text-[0.88rem] text-ink-50">
                    Your uploaded file scored{" "}
                    <span className="tabular-nums text-ink">{before}</span>.{" "}
                    {gained > 0
                      ? `This layout is worth ${gained} more, before you change a word.`
                      : gained === 0
                        ? "This layout scores the same — your file was already readable."
                        : "This copy is behind your upload; something did not come across in the parse."}
                  </p>
                )}
              </div>
            </div>

            <p className="mt-5 border-t border-ink-08 pt-4 text-[0.85rem] leading-relaxed text-ink-50">
              Scored by the same checks your upload went through — not a second, friendlier scale.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <PrintButton />
              <BuildDraftButton label="Start again from my resume" restart quiet />
            </div>
            <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-30">
              Print, then choose <span className="text-ink-50">Save as PDF</span>. It comes out as
              real text, which is the whole point — a picture of a resume scores nothing.
            </p>
          </section>

          <section className="rounded-2xl border border-ink-08 p-6">
            <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
              What the layout can&apos;t fix
            </h2>
            {failing.length ? (
              <ul className="mt-5 space-y-3">
                {failing.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex gap-3 text-[0.87rem] leading-relaxed">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink"
                    />
                    <span>
                      <strong className="font-medium">{c.label}.</strong>{" "}
                      <span className="text-ink-50">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-[0.88rem] leading-relaxed text-ink-30">
                Nothing left on the checklist. What&apos;s left is the writing.
              </p>
            )}
            <p className="mt-6 border-t border-ink-08 pt-4 text-[0.78rem] leading-relaxed text-ink-30">
              These are about what you wrote, not how it&apos;s arranged. Ask the agent about a
              specific bullet — it can see this document.
            </p>
          </section>
        </div>

        <h2 className="mt-10 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
          Preview
        </h2>
      </div>

      {/* The only thing that survives into the printout. */}
      <div className="rd-fit mt-4 print:mt-0">
        <div className="mx-auto w-fit shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(0,0,0,0.18)] print:shadow-none">
          <ResumeDocument content={draft.content} />
        </div>
      </div>
    </>
  );
}
