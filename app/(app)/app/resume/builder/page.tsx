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
 * The editor, and only the editor.
 *
 * A résumé here is a design: pages of objects that can be moved, resized,
 * restyled, layered and deleted. `content` — the typed résumé the parser and
 * the agent still write — is what a design is *seeded* from the first time it
 * is opened, and is what an ATS check will read when that is built as its own
 * feature. It is no longer the master copy, and nothing re-derives the page
 * from it, because a person who nudges a heading has made a decision.
 *
 * Old rows have `design: null`. They get one here, on first open, rather than
 * through a migration that rewrites every draft in the table — including the
 * ones belonging to people who never come back.
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

  const template = draft.template ?? DEFAULT_TEMPLATE;
  // An empty design counts as no design. A row that was created but never
  // opened has one blank page, and seeding that is right; a design somebody
  // deliberately emptied is not empty, it is a page with a background.
  const design =
    draft.design && !designIsEmpty(draft.design) ? draft.design : seedDesign(draft.content, template);

  return (
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
  );
}
