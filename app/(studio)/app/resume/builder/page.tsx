import Link from "next/link";
import { getPrimaryDraft, getPrimaryResume } from "@/lib/app/account";
import { getSessionUser } from "@/lib/supabase/app";
import { DesignEditor } from "@/components/app/DesignEditor";
import { BuildDraftButton } from "@/components/app/ResumeBuilderActions";
import { DEFAULT_TEMPLATE } from "@/lib/app/resume-templates";
import { designIsEmpty } from "@/lib/app/design";
import { seedDesign } from "@/lib/app/design-seed";
import { designTextLength, isThin, starterContent } from "@/lib/app/starter-content";
import { cleanResume } from "@/lib/app/resume-schema";
import { Builder } from "@/components/app/builder/Builder";

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
export default async function StudioResumeBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ classic?: string; v2?: string }>;
}) {
  const { classic, v2 } = await searchParams;
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
  // A saved design is kept unless it is effectively empty. Drafts made before
  // templates opened complete hold just a name and a contact line (under 200
  // characters of text); those are re-seeded with the template's starter
  // content so there is something to write over. Anything longer is the
  // person's work and is left exactly as it is.
  const hasOwnDesign =
    draft.design && !designIsEmpty(draft.design) &&
    !(isThin(draft.content) && designTextLength(draft.design) < 200);
  const design = hasOwnDesign
    ? draft.design!
    : seedDesign(starterContent(draft.content, template), template);

  /**
   * The form is the editor now. `?classic=1` still opens the canvas.
   *
   * It was going to be held back for the fifty-eight people whose résumé
   * only exists as a canvas design — their `content` stopped being updated
   * the day they started dragging, so the form shows them an older version
   * of themselves. That was the right call for a product with a back
   * catalogue and the wrong one for this: there are no returning users yet,
   * and making every new person use the editor that breaks in order to
   * protect fifty-eight who can rebuild in ten minutes is a bad trade.
   *
   * The canvas stays reachable rather than deleted, so nothing those drafts
   * hold is lost while their designs are harvested back into `content`.
   */
  const useForm = classic !== "1";
  void v2;

  if (useForm) {
    return (
      <Builder
        draftId={draft.id}
        initial={cleanResume(draft.content)}
        templateId={template}
        title={draft.title}
      />
    );
  }

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
