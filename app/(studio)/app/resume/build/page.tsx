import Link from "next/link";
import { getDraft } from "@/lib/app/resume-store";
import { cleanResume } from "@/lib/app/resume-schema";
import { FlowPreview } from "@/components/app/flow/FlowPreview";

export const dynamic = "force-dynamic";

/**
 * The new builder, so far: the document half.
 *
 * Nothing here can overflow a page, because nothing here has a position —
 * the résumé is flowed, measured and dealt onto sheets every time a word
 * changes. The editing half comes next; this exists so the engine can be
 * read against a real résumé rather than a sample before any form is built
 * on top of it.
 */
export default async function BuildPage() {
  const draft = await getDraft();
  const resume = cleanResume(draft?.content ?? {});

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.2rem] font-semibold tracking-[-0.02em]">New builder — preview</h1>
          <p className="mt-1 text-[0.85rem] text-ink-50">
            Your own résumé, flowed through the new engine. Pages are measured, not guessed.
          </p>
        </div>
        <Link
          href="/app/resume"
          className="rounded-full border border-ink-15 px-4 py-2 text-[0.82rem] transition-colors hover:border-ink"
        >
          Back
        </Link>
      </div>

      {!draft ? (
        <p className="rounded-2xl border border-dashed border-ink-15 p-8 text-center text-[0.9rem] text-ink-50">
          No résumé yet. Build one first and come back.
        </p>
      ) : (
        <FlowPreview resume={resume} templateId={draft.template ?? null} />
      )}
    </div>
  );
}
