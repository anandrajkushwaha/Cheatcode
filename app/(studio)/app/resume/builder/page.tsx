import Link from "next/link";
import { getPrimaryDraft, getPrimaryResume } from "@/lib/app/account";
import { getSessionUser } from "@/lib/supabase/app";
import { DesignEditor } from "@/components/app/DesignEditor";
import { BuildDraftButton } from "@/components/app/ResumeBuilderActions";
import { DEFAULT_TEMPLATE } from "@/lib/app/resume-templates";
import { designIsEmpty } from "@/lib/app/design";
import { seedDesign } from "@/lib/app/design-seed";

export const dynamic = "force-dynamic";

/**
 * The resume canvas, inside the studio.
 *
 * It existed only at /app/resume/builder, and three buttons on the studio's
 * own resume screen pushed people to it — so opening the editor threw you out
 * of the shell you were in, into the older one, with a different top bar. The
 * same DesignEditor is mounted here instead.
 *
 * The editor is the whole screen by design: a canvas with a sidebar inside a
 * 1160px column would be a canvas nobody can work on. It therefore breaks out
 * of the studio container rather than sitting in it.
 */
export default async function StudioResumeBuilderPage() {
  const [draft, resume, user] = await Promise.all([
    getPrimaryDraft(),
    getPrimaryResume(),
    getSessionUser(),
  ]);

  if (!draft) {
    return (
      <div className="space-y-5">
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Resume editor</h1>
        <p className="max-w-[62ch] text-[0.88rem] leading-relaxed text-ink-50">
          {resume
            ? "We'll start from the resume you already uploaded — your roles, dates and bullets, already in place."
            : "Upload a resume first. The editor starts from what you have already written rather than from a blank page."}
        </p>

        <div className="pt-1">
          {resume ? (
            <BuildDraftButton label="Build it from my resume" basePath="/app" />
          ) : (
            <Link
              href="/app/resume"
              className="inline-flex rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-semibold text-paper transition-opacity hover:opacity-90"
            >
              Upload a resume
            </Link>
          )}
        </div>
      </div>
    );
  }

  const template = draft.template ?? DEFAULT_TEMPLATE;
  const design =
    draft.design && !designIsEmpty(draft.design)
      ? draft.design
      : seedDesign(draft.content, template);

  return (
    // No wrapper. The editor is `fixed inset-0` and covers the whole screen on
    // its own. It used to sit inside a full-bleed div centred with
    // `-translate-x-1/2` — and a transformed ancestor becomes the containing
    // block for `position: fixed`, so the "full screen" editor was pinned to
    // that zero-height div instead: toolbar and footer stacked, canvas
    // squeezed to nothing.
    <>
      <DesignEditor
        draftId={draft.id}
        title={draft.title}
        content={draft.content}
        template={template}
        initialDesign={design}
        shareId={draft.share_id}
        isPublic={draft.is_public}
        linkRole={draft.link_role}
        ownerEmail={user?.email ?? null}
      />
    </>
  );
}
