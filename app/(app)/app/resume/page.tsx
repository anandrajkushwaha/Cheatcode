import Link from "next/link";
import { getPrimaryDraft, getPrimaryResume } from "@/lib/app/account";
import { ResumeUpload } from "@/components/app/ResumeUpload";
import { TemplateGallery } from "@/components/app/TemplateGallery";
import { BuildDraftButton } from "@/components/app/ResumeBuilderActions";
import { DEFAULT_TEMPLATE } from "@/lib/app/resume-templates";
import { getSessionUser } from "@/lib/supabase/app";
import { listSharedWithMe } from "@/lib/app/resume-store";

export const dynamic = "force-dynamic";

/**
 * The templates, and a way in.
 *
 * This page used to lead with an upload box and a summary of what we parsed out
 * of the last file, followed by a list of earlier uploads. All three were about
 * our process rather than about anything somebody came here to do, and the
 * parsed summary in particular was a read-only copy of information the editor
 * already shows in a form they can change.
 *
 * So the gallery is the page. Uploading is still how a resume gets in, but it
 * is a link beside the heading rather than the first thing on it — the front
 * door for the few visits where the answer is "start from my file", not a wall
 * everyone else has to walk past.
 */
export default async function ResumePage() {
  const user = await getSessionUser();
  const [draft, resume, shared] = await Promise.all([
    getPrimaryDraft(),
    getPrimaryResume(),
    listSharedWithMe(user?.email ?? null),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Resume templates</h1>

        <div className="flex items-center gap-4">
          {draft && (
            <Link
              href="/app/resume/builder"
              className="text-[0.82rem] text-ink-30 underline-offset-4 hover:text-ink hover:underline"
            >
              Open the editor
            </Link>
          )}
          <Link
            href="#upload"
            className="rounded-full border border-ink-15 px-4 py-2 text-[0.82rem] font-medium transition-colors hover:border-ink"
          >
            Upload resume
          </Link>
        </div>
      </div>

      {draft ? (
        <div className="mt-8">
          <TemplateGallery content={draft.content} current={draft.template ?? DEFAULT_TEMPLATE} />
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-ink-08 p-6">
          <p className="max-w-[58ch] text-[0.92rem] leading-relaxed text-ink-50">
            {resume
              ? "Build your document first, and every template will show your own resume in it — " +
                "your name, your jobs, your bullets — rather than a stranger's."
              : "Upload a resume to start. Every template shows your own document, so there has to " +
                "be one."}
          </p>
          <div className="mt-6">
            {resume ? (
              <BuildDraftButton label="Build it from my resume" />
            ) : (
              <Link
                href="#upload"
                className="inline-flex rounded-full bg-ink px-5 py-2.5 text-[0.85rem] font-semibold text-paper transition-transform hover:scale-[1.02]"
              >
                Upload a resume
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Resumes somebody else handed them. Below their own work rather than
          mixed into it: these are not theirs, and a list where "my resume" and
          "a resume I was shown" look alike is how somebody edits the wrong
          document and only finds out when the owner does. */}
      {shared.length > 0 && (
        <section className="mt-14 border-t border-ink-08 pt-8">
          <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
            Shared with you
          </h2>
          <ul className="mt-4 space-y-2">
            {shared.map((s) => (
              <li key={s.shareId}>
                <Link
                  href={s.role === "edit" ? `/r/${s.shareId}/edit` : `/r/${s.shareId}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-ink-08 px-4 py-3 transition-colors hover:border-ink-30"
                >
                  <span className="min-w-0 truncate text-[0.9rem] font-medium">{s.title}</span>
                  <span className="shrink-0 text-[0.78rem] text-ink-30">
                    {s.role === "edit" ? "You can edit" : "You can view"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Kept, and kept out of the way. Uploading is how the first draft gets
          its content; after that it is the thing almost nobody needs again. */}
      <section id="upload" className="mt-14 border-t border-ink-08 pt-8">
        <h2 className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-ink-30">
          Start from a file
        </h2>
        <p className="mt-2.5 max-w-[62ch] text-[0.88rem] leading-relaxed text-ink-50">
          We read it in your browser, score it, and pull out your skills, titles and experience —
          which is what the templates fill themselves in with.
        </p>
        <div className="mt-5">
          <ResumeUpload hasExisting={Boolean(resume)} />
        </div>
      </section>
    </>
  );
}
