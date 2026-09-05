import Link from "next/link";
import { getPrimaryDraft, getPrimaryResume } from "@/lib/app/account";
import { TemplateGallery } from "@/components/app/TemplateGallery";
import { BuildDraftButton } from "@/components/app/ResumeBuilderActions";
import { DEFAULT_TEMPLATE } from "@/lib/app/resume-templates";

export const dynamic = "force-dynamic";

/**
 * Choose how it looks.
 *
 * Deliberately its own screen rather than a dropdown in the editor. Picking a
 * template is a decision people want to take by looking, side by side, at
 * full size — a select menu of five names makes them click five times and
 * remember what the last one looked like.
 *
 * There is nothing to show without a draft, and no honest way to fake one:
 * a gallery of somebody else's resume is exactly the thing this page exists
 * not to be. So an empty state sends them to build the draft first, which is
 * one button and takes a second.
 */
export default async function TemplatesPage() {
  const [draft, resume] = await Promise.all([getPrimaryDraft(), getPrimaryResume()]);

  if (!draft) {
    return (
      <>
        <Header />
        <p className="mt-2.5 max-w-[62ch] text-[0.92rem] leading-relaxed text-ink-50">
          {resume
            ? "Build your document first and every template here will show your own resume in it."
            : "Upload a resume first. Every template shows your own document, so there has to be one."}
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

  return (
    <>
      <Header />
      <div className="mt-8">
        <TemplateGallery content={draft.content} current={draft.template ?? DEFAULT_TEMPLATE} />
      </div>
    </>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h1 className="text-2xl font-semibold tracking-[-0.03em]">Templates</h1>
      <Link
        href="/app/resume/builder"
        className="text-[0.82rem] text-ink-30 underline-offset-4 hover:text-ink hover:underline"
      >
        Back to the editor
      </Link>
    </div>
  );
}
