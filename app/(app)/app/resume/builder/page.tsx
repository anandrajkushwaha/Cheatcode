import Link from "next/link";
import { getPrimaryDraft, getPrimaryResume } from "@/lib/app/account";
import { getSessionUser } from "@/lib/supabase/app";
import { ResumeEditor } from "@/components/app/ResumeEditor";
import { BuildDraftButton } from "@/components/app/ResumeBuilderActions";
import { DEFAULT_TEMPLATE } from "@/lib/app/resume-templates";

export const dynamic = "force-dynamic";

/**
 * The editor, and only the editor.
 *
 * This page used to carry a score ring, a verdict, a checklist of what the
 * layout could not fix, a template rail and a row of buttons — all of it above
 * the document, all of it pushing the thing somebody came here to work on
 * below the fold. Every piece was defensible on its own and together they made
 * an editor you had to scroll past a dashboard to reach.
 *
 * The score has not been thrown away; it belongs where the decision is, which
 * is the template gallery, next to the template it describes. Here there is a
 * document, a way back to the templates, and Share.
 */
export default async function ResumeBuilderPage() {
  const [draft, resume, user] = await Promise.all([
    getPrimaryDraft(),
    getPrimaryResume(),
    getSessionUser(),
  ]);

  if (!draft) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Resume builder</h1>
        <p className="mt-2.5 max-w-[62ch] text-[0.92rem] leading-relaxed text-ink-50">
          {resume
            ? "We'll start from the resume you already uploaded — your roles, dates and bullets, " +
              "already in place."
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

  return (
    <ResumeEditor
      draftId={draft.id}
      initial={draft.content}
      template={draft.template ?? DEFAULT_TEMPLATE}
      title={draft.title}
      shareId={draft.share_id}
      isPublic={draft.is_public}
      linkRole={draft.link_role}
      ownerEmail={user?.email ?? null}
      initialStyles={draft.styles}
      initialPhoto={draft.photo}
    />
  );
}
